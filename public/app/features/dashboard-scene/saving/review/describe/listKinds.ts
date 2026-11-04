import { omit } from 'lodash';

import { standardTransformersRegistry } from '@grafana/data';
import { t } from '@grafana/i18n';
import { isRecord } from 'app/core/utils/isRecord';

import { displayShort, type ValueFormat } from './formatters';
import { humanizeKey, humanizePath } from './labels';
import { type ItemField, type NamedListItems } from './namedLists';
import { unescapeSegment, valueAt } from './paths';

export type NamedListKind =
  | 'variables'
  | 'annotations'
  | 'dashboardLinks'
  | 'panelLinks'
  | 'tags'
  | 'queries'
  | 'transformations'
  | 'overrides';

export interface ListKindContext {
  /** The field config label of an override property id, e.g. "Standard options › Unit". */
  fieldConfigLabel(id: string): string;
  /** How an override property's value reads, e.g. a unit by its name. */
  fieldConfigFormat?(id: string): ValueFormat;
}

const noEscape = { escapeValue: false };

export function listItemsOf(kind: NamedListKind, ctx: ListKindContext): NamedListItems {
  switch (kind) {
    case 'variables':
      return variables;
    case 'annotations':
      return annotations;
    case 'dashboardLinks':
    case 'panelLinks':
      return links;
    case 'tags':
      return tags;
    case 'queries':
      return queries;
    case 'transformations':
      return transformations;
    case 'overrides':
      return overrides(ctx);
  }
}

const auto: ValueFormat = { type: 'auto' };

/** A field one level below `base` in the item, labelled from `labels` or humanized. */
function keyedField(
  path: string[],
  base: string[],
  labels: () => Record<string, string>,
  formats: Record<string, ValueFormat> = {}
): ItemField | undefined {
  if (path.length <= base.length || !base.every((segment, index) => path[index] === segment)) {
    return undefined;
  }
  const key = path[base.length];
  const fieldPath = [...base, key];
  const name = unescapeSegment(key);
  const known = labels();
  return {
    key: fieldPath.join('/'),
    label: Object.hasOwn(known, name) ? known[name] : humanizeKey(name),
    format: Object.hasOwn(formats, name) ? formats[name] : auto,
    read: (item) => valueAt(item, fieldPath),
  };
}

/** Anything else: the path up to the first array index, humanized. */
function fallbackField(path: string[], skip = 0): ItemField {
  const end = path.findIndex((segment) => /^\d+$/.test(segment));
  const fieldPath = end === -1 ? path : path.slice(0, end);
  return {
    key: fieldPath.join('/'),
    label: humanizePath(fieldPath.slice(skip)),
    format: auto,
    read: (item) => valueAt(item, fieldPath),
  };
}

function nameOf(item: unknown, path: string[]): string {
  const value = valueAt(item, path);
  return typeof value === 'string' ? value : '';
}

const variables: NamedListItems = {
  keyOf: (item) => nameOf(item, ['spec', 'name']),
  nameOf: (item) => variableName(valueAt(item, ['kind']), nameOf(item, ['spec', 'name'])),
  detailsOf: (item) => variableConfig(item),
  fieldOf: (path, before, after) => {
    if (path[0] === 'kind') {
      return {
        key: 'kind',
        label: t('dashboard-scene.review.item-field.variable-type', 'Type'),
        format: { type: 'name', display: displayVariableKind },
        read: (item) => valueAt(item, ['kind']),
      };
    }
    if (path[0] === 'datasource') {
      return {
        key: 'datasource',
        label: variableLabels().datasource,
        format: auto,
        read: (item) => valueAt(item, ['datasource']),
      };
    }
    return (
      keyedField(path, ['spec'], variableLabels, variableTextFormats(valueAt(after ?? before, ['kind']))) ??
      fallbackField(path)
    );
  },
  orderLabel: () => t('dashboard-scene.review.item-order.variables', 'Variable order'),
  subjectOf: (item) => (valueAt(item, ['kind']) === 'AdhocVariable' ? 'adHocFilter' : 'variable'),
};

/** A variable named by its type, as the variable editor calls it: `Query variable "env"`. */
function variableName(kind: unknown, name: string): string {
  const options = { name, interpolation: noEscape };
  switch (kind) {
    case 'QueryVariable':
      return t('dashboard-scene.review.item.query-variable', 'Query variable "{{name}}"', options);
    case 'CustomVariable':
      return t('dashboard-scene.review.item.custom-variable', 'Custom variable "{{name}}"', options);
    case 'AdhocVariable':
      return t('dashboard-scene.review.item.adhoc-variable', 'Ad hoc filters "{{name}}"', options);
    case 'GroupByVariable':
      return t('dashboard-scene.review.item.group-by-variable', 'Group by variable "{{name}}"', options);
    case 'DatasourceVariable':
      return t('dashboard-scene.review.item.datasource-variable', 'Data source variable "{{name}}"', options);
    case 'IntervalVariable':
      return t('dashboard-scene.review.item.interval-variable', 'Interval variable "{{name}}"', options);
    case 'TextVariable':
      return t('dashboard-scene.review.item.text-variable', 'Text box variable "{{name}}"', options);
    case 'ConstantVariable':
      return t('dashboard-scene.review.item.constant-variable', 'Constant variable "{{name}}"', options);
    case 'SwitchVariable':
      return t('dashboard-scene.review.item.switch-variable', 'Switch variable "{{name}}"', options);
    default:
      return t('dashboard-scene.review.item.variable', 'Variable "{{name}}"', options);
  }
}

/** The configuration of an added or removed item, as JSON until its settings are listed one by one. */
function configJson(item: unknown): string | undefined {
  return isRecord(item) ? JSON.stringify(item, null, 2) : undefined;
}

/** `options` is left out: it holds the values the variable last resolved to, which can be a long list. */
function variableConfig(item: unknown): string | undefined {
  if (!isRecord(item)) {
    return undefined;
  }
  return configJson(isRecord(item.spec) ? { ...item, spec: omit(item.spec, 'options') } : item);
}

const text: ValueFormat = { type: 'auto', quoted: true };

/** Variable settings typed into a text box; a query is one only for custom, text box and constant variables. */
function variableTextFormats(kind: unknown): Record<string, ValueFormat> {
  const formats: Record<string, ValueFormat> = {
    label: text,
    description: text,
    regex: text,
    allValue: text,
    placeholder: text,
  };
  if (kind === 'CustomVariable' || kind === 'TextVariable' || kind === 'ConstantVariable') {
    formats.query = text;
  }
  return formats;
}

function variableLabels(): Record<string, string> {
  return {
    label: t('dashboard-scene.review.item-field.variable-label', 'Label'),
    description: t('dashboard-scene.review.item-field.variable-description', 'Description'),
    hide: t('dashboard-scene.review.item-field.variable-hide', 'Display'),
    query: t('dashboard-scene.review.item-field.variable-query', 'Query'),
    regex: t('dashboard-scene.review.item-field.variable-regex', 'Regex'),
    sort: t('dashboard-scene.review.item-field.variable-sort', 'Sort'),
    refresh: t('dashboard-scene.review.item-field.variable-refresh', 'Refresh'),
    multi: t('dashboard-scene.review.item-field.variable-multi', 'Multi-value'),
    includeAll: t('dashboard-scene.review.item-field.variable-include-all', 'Include All option'),
    allValue: t('dashboard-scene.review.item-field.variable-all-value', 'Custom all value'),
    current: t('dashboard-scene.review.item-field.variable-current', 'Current value'),
    options: t('dashboard-scene.review.item-field.variable-options', 'Options'),
    datasource: t('dashboard-scene.review.item-field.variable-datasource', 'Data source'),
    allowCustomValue: t('dashboard-scene.review.item-field.variable-allow-custom-value', 'Allow custom values'),
    skipUrlSync: t('dashboard-scene.review.item-field.variable-skip-url-sync', 'Skip URL sync'),
  };
}

function displayVariableKind(kind: unknown): string | undefined {
  switch (kind) {
    case 'QueryVariable':
      return t('dashboard-scene.review.value.variable-kind-query', 'Query');
    case 'CustomVariable':
      return t('dashboard-scene.review.value.variable-kind-custom', 'Custom');
    case 'AdhocVariable':
      return t('dashboard-scene.review.value.variable-kind-adhoc', 'Ad hoc filters');
    case 'GroupByVariable':
      return t('dashboard-scene.review.value.variable-kind-group-by', 'Group by');
    case 'DatasourceVariable':
      return t('dashboard-scene.review.value.variable-kind-datasource', 'Data source');
    case 'IntervalVariable':
      return t('dashboard-scene.review.value.variable-kind-interval', 'Interval');
    case 'TextVariable':
      return t('dashboard-scene.review.value.variable-kind-text', 'Text box');
    case 'ConstantVariable':
      return t('dashboard-scene.review.value.variable-kind-constant', 'Constant');
    case 'SwitchVariable':
      return t('dashboard-scene.review.value.variable-kind-switch', 'Switch');
    default:
      return typeof kind === 'string' ? humanizeKey(kind.replace(/Variable$/, '')) : undefined;
  }
}

const annotations: NamedListItems = {
  keyOf: (item) => nameOf(item, ['spec', 'name']),
  nameOf: (item) =>
    t('dashboard-scene.review.item.annotation', 'Annotation "{{name}}"', {
      name: nameOf(item, ['spec', 'name']),
      interpolation: noEscape,
    }),
  detailsOf: configJson,
  fieldOf: (path) => keyedField(path, ['spec'], annotationLabels) ?? fallbackField(path),
  orderLabel: () => t('dashboard-scene.review.item-order.annotations', 'Annotation order'),
  subjectOf: () => 'annotation',
};

function annotationLabels(): Record<string, string> {
  return {
    enable: t('dashboard-scene.review.item-field.annotation-enable', 'Enabled'),
    hide: t('dashboard-scene.review.item-field.annotation-hide', 'Hidden'),
    iconColor: t('dashboard-scene.review.item-field.annotation-icon-color', 'Color'),
    query: t('dashboard-scene.review.item-field.annotation-query', 'Query'),
    filter: t('dashboard-scene.review.item-field.annotation-filter', 'Show in'),
  };
}

const links: NamedListItems = {
  keyOf: (item) => nameOf(item, ['title']),
  nameOf: (item) =>
    t('dashboard-scene.review.item.link', 'Link "{{title}}"', {
      title: nameOf(item, ['title']),
      interpolation: noEscape,
    }),
  detailsOf: configJson,
  fieldOf: (path) => keyedField(path, [], linkLabels, { url: text, tooltip: text }),
  orderLabel: () => t('dashboard-scene.review.item-order.links', 'Link order'),
  subjectOf: () => 'link',
};

function linkLabels(): Record<string, string> {
  return {
    url: t('dashboard-scene.review.item-field.link-url', 'URL'),
    tooltip: t('dashboard-scene.review.item-field.link-tooltip', 'Tooltip'),
    icon: t('dashboard-scene.review.item-field.link-icon', 'Icon'),
    type: t('dashboard-scene.review.item-field.link-type', 'Type'),
    tags: t('dashboard-scene.review.item-field.link-tags', 'Tags'),
    asDropdown: t('dashboard-scene.review.item-field.link-as-dropdown', 'Show as dropdown'),
    targetBlank: t('dashboard-scene.review.item-field.link-target-blank', 'Open in new tab'),
    includeVars: t('dashboard-scene.review.item-field.link-include-vars', 'Include current template variable values'),
    keepTime: t('dashboard-scene.review.item-field.link-keep-time', 'Include current time range'),
    placement: t('dashboard-scene.review.item-field.link-placement', 'Placement'),
  };
}

const tags: NamedListItems = {
  keyOf: (item) => displayShort(item),
  nameOf: (item) =>
    t('dashboard-scene.review.item.tag', 'Tag "{{tag}}"', { tag: displayShort(item), interpolation: noEscape }),
  fieldOf: () => undefined,
  orderLabel: () => t('dashboard-scene.review.item-order.tags', 'Tag order'),
  subjectOf: () => 'tag',
};

const queries: NamedListItems = {
  keyOf: (item) => nameOf(item, ['spec', 'refId']),
  nameOf: (item) =>
    t('dashboard-scene.review.item.query', 'Query "{{refId}}"', {
      refId: nameOf(item, ['spec', 'refId']),
      interpolation: noEscape,
    }),
  fieldOf: (path) => {
    if (path[0] !== 'spec') {
      return fallbackField(path);
    }
    if (path[1] === 'hidden') {
      return {
        key: 'hidden',
        label: t('dashboard-scene.review.item-field.query-hidden', 'Hide response'),
        format: { type: 'boolean' },
        read: (item) => valueAt(item, ['spec', 'hidden']),
      };
    }
    if (path[1] === 'query' && (path[2] === 'datasource' || path[2] === 'group')) {
      return {
        key: 'datasource',
        label: t('dashboard-scene.review.item-field.query-datasource', 'Data source'),
        format: { type: 'name' },
        read: (item) => {
          const name = valueAt(item, ['spec', 'query', 'datasource', 'name']);
          return typeof name === 'string' && name ? name : valueAt(item, ['spec', 'query', 'group']);
        },
      };
    }
    if (path[1] === 'query' && path[2] === 'spec') {
      return (
        keyedField(path, ['spec', 'query', 'spec'], queryTextLabels, { legendFormat: text }) ?? {
          key: 'spec/query/spec',
          label: t('dashboard-scene.review.item-field.query-body', 'Query'),
          format: { type: 'long' },
          read: (item) => valueAt(item, ['spec', 'query', 'spec']),
        }
      );
    }
    return fallbackField(path, path[1] === 'query' ? 2 : 1);
  },
  orderLabel: () => t('dashboard-scene.review.item-order.queries', 'Query order'),
  subjectOf: () => 'query',
};

/** The query-text keys of common data sources, all labelled the same. */
function queryTextLabels(): Record<string, string> {
  const label = t('dashboard-scene.review.item-field.query-text', 'Query text');
  return { expr: label, query: label, rawSql: label, rawQuery: label, queryText: label, expression: label };
}

const transformations: NamedListItems = {
  keyOf: (item) => nameOf(item, ['group']),
  nameOf: (item, index, all) => {
    const id = nameOf(item, ['group']);
    const name = transformationName(id);
    const sameId = all.filter((other) => nameOf(other, ['group']) === id);
    if (sameId.length > 1) {
      const position = all.slice(0, index + 1).filter((other) => nameOf(other, ['group']) === id).length;
      return t('dashboard-scene.review.item.transformation-nth', '', {
        count: position,
        ordinal: true,
        name,
        interpolation: noEscape,
        defaultValue_one: 'Transformation "{{name}}" ({{count}}th)',
        defaultValue_other: 'Transformation "{{name}}" ({{count}}th)',
        defaultValue_ordinal_one: 'Transformation "{{name}}" ({{count}}st)',
        defaultValue_ordinal_two: 'Transformation "{{name}}" ({{count}}nd)',
        defaultValue_ordinal_few: 'Transformation "{{name}}" ({{count}}rd)',
        defaultValue_ordinal_other: 'Transformation "{{name}}" ({{count}}th)',
      });
    }
    return t('dashboard-scene.review.item.transformation', 'Transformation "{{name}}"', {
      name,
      interpolation: noEscape,
    });
  },
  fieldOf: (path) => {
    if (path[0] === 'spec' && path[1] === 'options') {
      return keyedField(path, ['spec', 'options'], () => ({})) ?? fallbackField(path, 1);
    }
    return keyedField(path, ['spec'], transformationLabels) ?? fallbackField(path);
  },
  orderLabel: () => t('dashboard-scene.review.item-order.transformations', 'Transformation order'),
  subjectOf: () => 'transformation',
};

function transformationLabels(): Record<string, string> {
  return {
    disabled: t('dashboard-scene.review.item-field.transformation-disabled', 'Disabled'),
    filter: t('dashboard-scene.review.item-field.transformation-filter', 'Filter'),
    topic: t('dashboard-scene.review.item-field.transformation-topic', 'Applies to'),
  };
}

function transformationName(id: string): string {
  try {
    return standardTransformersRegistry.getIfExists(id)?.name ?? id;
  } catch {
    return id;
  }
}

function overrides(ctx: ListKindContext): NamedListItems {
  const propertyField = (id: string): ItemField => ({
    key: `property:${id}`,
    label: ctx.fieldConfigLabel(id),
    format: ctx.fieldConfigFormat?.(id) ?? auto,
    read: (item) => propertyValue(item, id),
  });
  return {
    keyOf: (item) => JSON.stringify(valueAt(item, ['matcher']) ?? null),
    nameOf: (item) => {
      const options = valueAt(item, ['matcher', 'options']);
      const id = valueAt(item, ['matcher', 'id']);
      const name = typeof options === 'string' ? options : typeof id === 'string' ? humanizeKey(id) : '';
      return t('dashboard-scene.review.item.override', 'Override "{{name}}"', { name, interpolation: noEscape });
    },
    fieldOf: (path, before, after) => {
      if (path[0] === 'properties') {
        const index = Number(path[1]);
        const id = valueAt(after, ['properties', index, 'id']) ?? valueAt(before, ['properties', index, 'id']);
        return typeof id === 'string' ? propertyField(id) : undefined;
      }
      return fallbackField(path);
    },
    fieldsOf: (before, after) => {
      const ids = [...propertyIds(after), ...propertyIds(before)].filter((id, index, all) => all.indexOf(id) === index);
      const others = [...new Set([...Object.keys(asRecord(before)), ...Object.keys(asRecord(after))])]
        .filter((key) => key !== 'properties' && key !== 'matcher')
        .sort()
        .map((key) => fallbackField([key]));
      return [...ids.map(propertyField), ...others];
    },
    orderLabel: () => t('dashboard-scene.review.item-order.overrides', 'Override order'),
    subjectOf: () => 'override',
  };
}

function propertyIds(item: unknown): string[] {
  const properties = valueAt(item, ['properties']);
  if (!Array.isArray(properties)) {
    return [];
  }
  return properties.map((property) => valueAt(property, ['id'])).filter((id): id is string => typeof id === 'string');
}

function propertyValue(item: unknown, id: string): unknown {
  const properties = valueAt(item, ['properties']);
  if (!Array.isArray(properties)) {
    return undefined;
  }
  const property = properties.find((candidate) => valueAt(candidate, ['id']) === id);
  return isRecord(property) ? property.value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
