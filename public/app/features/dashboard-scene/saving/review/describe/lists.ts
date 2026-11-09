import { isEqual } from 'lodash';

import { standardTransformersRegistry } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { isRecord } from 'app/core/utils/isRecord';

import { type EditableVariableType, getVariableTypeLabel } from '../../../settings/variables/utils';
import { type Diff } from '../../../settings/version-history/utils';
import { humanizeKey, noEscape } from '../richText';
import { pathKey, type PathKey, type ReviewChange, type ReviewElementKind, type ReviewProperty } from '../types';

import {
  asArray,
  assignClaims,
  flatDiff,
  hasPrefix,
  hasValueAt,
  isUnset,
  pathUpTo,
  safely,
  unescapeSegment,
  untilIndex,
  valueAt,
} from './paths';
import {
  everything,
  type IsDefault,
  property,
  type PropertyFormat,
  quoted,
  recordProperties,
  withoutDefaults,
} from './properties';
import { variableDefault } from './systemDefaults';
import {
  added,
  changed,
  describeValue,
  displayShort,
  humanizePath,
  joinLabel,
  removed,
  type ValueFormat,
  type Worded,
} from './wording';

// --- List kinds ---

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

// Where a field without a place in its item's labels goes when several fields of one item change.
const FIRST = -1;
const UNLABELLED = 1000;
const LAST = 2000;

/** A field's place among its item's fields: the order of `labels`, the editor's order. */
function orderIn(labels: Record<string, string>, key: string): number {
  const index = Object.keys(labels).indexOf(key);
  return index === -1 ? UNLABELLED : index;
}

/** A field one level below `base` in the item, labelled from `labels` or humanized, in the order of `labels`. */
function keyedField(
  path: string[],
  base: string[],
  labels: () => Record<string, string>,
  formats: Record<string, ValueFormat> = {}
): ItemField | undefined {
  if (path.length <= base.length || !hasPrefix(path, base)) {
    return undefined;
  }
  const key = path[base.length];
  const fieldPath = [...base, key];
  const name = unescapeSegment(key);
  const known = labels();
  return {
    key: pathKey(fieldPath),
    label: Object.hasOwn(known, name) ? known[name] : humanizeKey(name),
    format: Object.hasOwn(formats, name) ? formats[name] : auto,
    order: orderIn(known, name),
    read: (item) => valueAt(item, fieldPath),
  };
}

/** Anything else: the path up to the first array index, humanized. */
function fallbackField(path: string[], skip = 0): ItemField {
  const fieldPath = untilIndex(path);
  return {
    key: pathKey(fieldPath),
    label: humanizePath(fieldPath.slice(skip)),
    format: auto,
    order: UNLABELLED,
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
  // `options` holds the values the variable last resolved to, which can be a long list.
  propertiesOf: (item, path, isDefault) => [
    ...recordProperties(valueAt(item, ['spec']), [...path, 'spec'], withKindDefaults(item, path, isDefault), {
      labels: variableLabels(),
      formats: { ...quotedFormats(variableTextFormats(valueAt(item, ['kind']))), current: { display: currentText } },
      skip: ['name', 'options'],
    }),
  ],
  fieldOf: (path, before, after) => {
    if (path[0] === 'kind') {
      return {
        key: 'kind',
        label: t('dashboard-scene.review.item-field.variable-type', 'Type'),
        format: { type: 'name', display: displayVariableKind },
        order: FIRST,
        read: (item) => valueAt(item, ['kind']),
      };
    }
    if (path[0] === 'datasource') {
      return {
        key: 'datasource',
        label: variableLabels().datasource,
        format: auto,
        order: orderIn(variableLabels(), 'datasource'),
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

/**
 * A variable's schema defaults by its kind, wherever it is: the path-based defaults only know the dashboard's
 * own variables, not a row's or a tab's.
 */
function withKindDefaults(item: unknown, path: string[], isDefault: IsDefault): IsDefault {
  if (isDefault === everything) {
    return isDefault;
  }
  const defaults = variableDefault(valueAt(item, ['kind']));
  return (absolute, value) => {
    if (isDefault(absolute, value)) {
      return true;
    }
    const expected = valueAt(defaults, absolute.slice(path.length));
    return expected !== undefined && isEqual(expected, value);
  };
}

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

const text: ValueFormat = { type: 'auto', quoted: true };

/** Fields worded with quotes are shown with quotes in a property list too. */
function quotedFormats(formats: Record<string, ValueFormat>): Record<string, PropertyFormat> {
  const quoted: Record<string, PropertyFormat> = {};
  for (const [key, format] of Object.entries(formats)) {
    if ('quoted' in format && format.quoted) {
      quoted[key] = { quoted: true };
    }
  }
  return quoted;
}

/** A variable's current value by what the picker shows: its text, or the texts of a multi-value selection. */
function currentText(current: unknown): string | undefined {
  const value = valueAt(current, ['text']);
  if (typeof value === 'string') {
    return quoted(value);
  }
  return Array.isArray(value) ? value.map((item) => quoted(String(item))).join(', ') : undefined;
}

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
    datasource: t('dashboard-scene.review.item-field.variable-datasource', 'Data source'),
    query: t('dashboard-scene.review.item-field.variable-query', 'Query'),
    regex: t('dashboard-scene.review.item-field.variable-regex', 'Regex'),
    sort: t('dashboard-scene.review.item-field.variable-sort', 'Sort'),
    refresh: t('dashboard-scene.review.item-field.variable-refresh', 'Refresh'),
    multi: t('dashboard-scene.review.item-field.variable-multi', 'Multi-value'),
    allowCustomValue: t('dashboard-scene.review.item-field.variable-allow-custom-value', 'Allow custom values'),
    includeAll: t('dashboard-scene.review.item-field.variable-include-all', 'Include All option'),
    allValue: t('dashboard-scene.review.item-field.variable-all-value', 'Custom all value'),
    current: t('dashboard-scene.review.item-field.variable-current', 'Current value'),
    options: t('dashboard-scene.review.item-field.variable-options', 'Options'),
    skipUrlSync: t('dashboard-scene.review.item-field.variable-skip-url-sync', 'Skip URL sync'),
  };
}

const variableTypes = new Map<string, EditableVariableType>(
  Object.entries({
    QueryVariable: 'query',
    CustomVariable: 'custom',
    AdhocVariable: 'adhoc',
    GroupByVariable: 'groupby',
    DatasourceVariable: 'datasource',
    IntervalVariable: 'interval',
    TextVariable: 'textbox',
    ConstantVariable: 'constant',
    SwitchVariable: 'switch',
  } satisfies Record<VariableKind['kind'], EditableVariableType>)
);

/** A variable's type as the type picker in a dashboard names it. */
function displayVariableKind(kind: unknown): string | undefined {
  if (typeof kind !== 'string') {
    return undefined;
  }
  const type = variableTypes.get(kind);
  return type ? getVariableTypeLabel(type) : humanizeKey(kind.replace(/Variable$/, ''));
}

const annotations: NamedListItems = {
  keyOf: (item) => nameOf(item, ['spec', 'name']),
  nameOf: (item) =>
    t('dashboard-scene.review.item.annotation', 'Annotation "{{name}}"', {
      name: nameOf(item, ['spec', 'name']),
      interpolation: noEscape,
    }),
  propertiesOf: (item, path, isDefault) =>
    recordProperties(valueAt(item, ['spec']), [...path, 'spec'], isDefault, {
      labels: annotationLabels(),
      skip: ['name'],
    }),
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
  propertiesOf: (item, path, isDefault) =>
    recordProperties(item, path, isDefault, {
      labels: linkLabels(),
      formats: { url: { quoted: true }, tooltip: { quoted: true } },
      skip: ['title'],
    }),
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
        order: LAST,
        read: (item) => valueAt(item, ['spec', 'hidden']),
      };
    }
    if (path[1] === 'query' && (path[2] === 'datasource' || path[2] === 'group')) {
      return {
        key: 'datasource',
        label: t('dashboard-scene.review.item-field.query-datasource', 'Data source'),
        format: { type: 'name' },
        order: FIRST,
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
          order: 0,
          read: (item) => valueAt(item, ['spec', 'query', 'spec']),
        }
      );
    }
    return fallbackField(path, path[1] === 'query' ? 2 : 1);
  },
  propertiesOf: (item, path, isDefault) => {
    const datasource = valueAt(item, ['spec', 'query', 'datasource', 'name']);
    return [
      property(
        t('dashboard-scene.review.item-field.query-datasource', 'Data source'),
        typeof datasource === 'string' && datasource ? datasource : valueAt(item, ['spec', 'query', 'group'])
      ),
      ...recordProperties(valueAt(item, ['spec', 'query', 'spec']), [...path, 'spec', 'query', 'spec'], isDefault, {
        labels: queryTextLabels(),
        formats: { legendFormat: { quoted: true } },
      }),
      property(t('dashboard-scene.review.item-field.query-hidden', 'Hide response'), valueAt(item, ['spec', 'hidden'])),
    ].filter((entry): entry is ReviewProperty => entry !== undefined);
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
  propertiesOf: (item, path, isDefault) =>
    recordProperties(valueAt(item, ['spec']), [...path, 'spec'], isDefault, {
      labels: { ...transformationLabels(), options: t('dashboard-scene.review.field.options', 'Options') },
      skip: ['id'],
    }),
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
  return safely(() => standardTransformersRegistry.getIfExists(id)?.name) ?? id;
}

function overrides(ctx: ListKindContext): NamedListItems {
  const propertyField = (id: string): ItemField => ({
    key: `property:${id}`,
    label: ctx.fieldConfigLabel(id),
    format: ctx.fieldConfigFormat?.(id) ?? auto,
    order: 0,
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
    propertiesOf: (item, path, isDefault) =>
      propertyIds(item)
        .map((id, index) =>
          property(
            ctx.fieldConfigLabel(id),
            withoutDefaults(propertyValue(item, id), [...path, 'properties', String(index), 'value'], isDefault)
          )
        )
        .filter((entry): entry is ReviewProperty => entry !== undefined),
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

// --- Named lists ---

/** A field of a list item: changes inside it are worded as one line. */
interface ItemField {
  /** Identifies the field within its item. */
  key: string;
  label: string;
  format: ValueFormat;
  /** Where the field is listed when several fields of its item change; ties go by key. */
  order: number;
  read: (item: unknown) => unknown;
}

/** How the items of one list are identified, named and split into fields (WORDING.md §8). */
interface NamedListItems {
  /** A stable identity (ref ID, name, title, matcher). Duplicates are told apart by occurrence. */
  keyOf(item: unknown): string;
  /** "Query A", "Variable 'env'". `all` is the item's own side, for names that depend on siblings. */
  nameOf(item: unknown, index: number, all: unknown[]): string;
  /** The field a path inside an item belongs to (escaped segments, relative to the item). */
  fieldOf(path: string[], before: unknown, after: unknown): ItemField | undefined;
  /** The fields to compare, in the order to list them, when they can't be derived from the paths that differ. */
  fieldsOf?(before: unknown, after: unknown): ItemField[];
  /** "Query order", for "Query order: changed". */
  orderLabel(): string;
  /** The kind of element an item is; every line about the list carries it. */
  subjectOf(item: unknown): ReviewElementKind;
  /** What an added or removed item reads as, when more than its name (a show / hide rule with its value). */
  elementText?(item: unknown, index: number, all: unknown[]): string;
  /**
   * What an added or removed item is set to, revealed by its toggle. `path` is the item's absolute path on its
   * own side; `isDefault` tells what Grafana filled in there.
   */
  propertiesOf?(item: unknown, path: string[], isDefault: IsDefault): ReviewProperty[];
}

export interface ListContext {
  /** Whether an `add` at `path` (absolute) is a system default, given what the baseline has. */
  isDefault(path: string[], value: unknown, baselineHas: (path: string[]) => boolean): boolean;
  /** Whether a value of a new element is a default, judged on the side the element is on. */
  isDefaultOn?(side: 'baseline' | 'payload'): IsDefault;
}

interface Slot {
  worded: Worded;
  /** A field change worded without the item's name, for when it is listed under the item. */
  inner?: Worded;
  /** Field changes: the index of the item in the payload. */
  index?: number;
  claims: PathKey[];
  /** Field key for field changes of a matched item. */
  field?: string;
  /** Sort position in the payload's order; removed items sit after their baseline predecessor. */
  position: number;
}

/**
 * Item-level changes of a list whose items have an identity of their own. jsonDiff compares arrays by index,
 * so an insertion or removal shows up as field changes on every shifted item; each such path is claimed once,
 * by the structural change (removal, addition or reorder) that caused it, and unchanged items show nothing.
 *
 * `listPath` is the escaped path of the array; `diffs` are the non-default diffs at or below it.
 */
export function describeNamedList(
  listPath: string[],
  before: unknown[],
  after: unknown[],
  diffs: Diff[],
  items: NamedListItems,
  ctx: ListContext
): Array<Worded & { claims: PathKey[] }> {
  const beforeKeys = withOccurrence(before.map((item) => items.keyOf(item)));
  const afterKeys = withOccurrence(after.map((item) => items.keyOf(item)));
  const beforeIndexByKey = new Map(beforeKeys.map((key, index) => [key, index]));
  const afterIndexByKey = new Map(afterKeys.map((key, index) => [key, index]));
  const matchedBefore: Array<number | undefined> = afterKeys.map((key) => beforeIndexByKey.get(key));

  // Every added or removed element can be reviewed: when nothing differs from the defaults, the defaults are
  // what it is set to.
  const propertiesOf = (item: unknown, index: number, side: 'baseline' | 'payload') => {
    const path = [...listPath, String(index)];
    if (!items.propertiesOf) {
      return [];
    }
    const set = items.propertiesOf(item, path, ctx.isDefaultOn?.(side) ?? everything);
    const all = set.length ? set : items.propertiesOf(item, path, everything);
    return all.length ? all : [{ label: t('dashboard-scene.review.property.no-settings', 'No settings') }];
  };
  const addedSlots = new Map<number, Slot>();
  const fieldSlots = new Map<number, Slot[]>();
  const removedSlots = new Map<number, Slot>();

  after.forEach((item, index) => {
    const beforeIndex = matchedBefore[index];
    const name = items.nameOf(item, index, after);
    if (beforeIndex === undefined) {
      const text = items.elementText?.(item, index, after) ?? name;
      const properties = propertiesOf(item, index, 'payload');
      addedSlots.set(index, {
        worded: {
          kind: 'added',
          text,
          subject: items.subjectOf(item),
          ...(properties.length > 0 && { properties }),
        },
        claims: [],
        position: index,
      });
      return;
    }
    const beforeItem = before[beforeIndex];
    const isDefault = (path: string[], value: unknown) =>
      ctx.isDefault([...listPath, String(index), ...path], value, (absolute) =>
        hasValueAt(beforeItem, absolute.slice(listPath.length + 1))
      );
    const slots = changedFields(beforeItem, item, items, isDefault).map((field, order) => ({
      worded: {
        ...describeValue(joinLabel([name, field.label]), field.read(beforeItem), field.read(item), field.format),
        subject: items.subjectOf(item),
      },
      inner: describeValue(field.label, field.read(beforeItem), field.read(item), field.format),
      index,
      claims: [],
      field: field.key,
      position: index + order / 1e3,
    }));
    if (slots.length) {
      fieldSlots.set(index, slots);
    }
  });

  before.forEach((item, index) => {
    if (afterIndexByKey.has(beforeKeys[index])) {
      return;
    }
    const properties = propertiesOf(item, index, 'baseline');
    removedSlots.set(index, {
      worded: {
        kind: 'removed',
        text: items.elementText?.(item, index, before) ?? items.nameOf(item, index, before),
        subject: items.subjectOf(item),
        ...(properties.length > 0 && { properties }),
      },
      claims: [],
      position: positionOfRemoved(index, beforeKeys, afterIndexByKey),
    });
  });

  const kept = matchedBefore.filter((index): index is number => index !== undefined);
  const reorder: Slot | undefined = kept.some((index, position) => position > 0 && index < kept[position - 1])
    ? {
        worded: {
          ...changed(items.orderLabel()),
          subject: items.subjectOf(after[0]),
          details: {
            before: () =>
              [...kept]
                .sort((a, b) => a - b)
                .map((index) => items.nameOf(before[index], index, before))
                .join('\n'),
            after: () =>
              matchedBefore
                .map((index, afterIndex) =>
                  index === undefined ? undefined : items.nameOf(after[afterIndex], afterIndex, after)
                )
                .filter((name) => name !== undefined)
                .join('\n'),
          },
        },
        claims: [],
        position: Number.MAX_SAFE_INTEGER,
      }
    : undefined;

  const structural = [...removedSlots.values(), ...addedSlots.values(), ...(reorder ? [reorder] : [])];
  const extra: Slot[] = [];
  const firstChange = (): Slot => {
    const slot = structural[0] ?? [...fieldSlots.values()][0]?.[0] ?? extra[0];
    if (slot) {
      return slot;
    }
    const created: Slot = {
      worded: { ...changed(items.orderLabel()), subject: items.subjectOf(after[0] ?? before[0]) },
      claims: [],
      position: Number.MAX_SAFE_INTEGER,
    };
    extra.push(created);
    return created;
  };

  for (const diff of diffs) {
    const key = pathKey(diff.path);
    const index = diff.path.length > listPath.length ? Number(diff.path[listPath.length]) : NaN;
    if (!Number.isInteger(index)) {
      firstChange().claims.push(key);
      continue;
    }
    const target =
      addedSlots.get(index) ??
      (matchedBefore[index] === index ? fieldSlotFor(diff, index) : undefined) ??
      (index >= after.length || matchedBefore[index] !== index ? removedSlots.get(index) : undefined);
    if (target) {
      target.claims.push(key);
    } else if (matchedBefore[index] === index) {
      // A difference no field accounts for: show it rather than drop it.
      const slot: Slot = {
        worded: { ...changed(items.nameOf(after[index], index, after)), subject: items.subjectOf(after[index]) },
        inner: changed(t('dashboard-scene.review.item-field.other', 'Other settings')),
        index,
        claims: [key],
        position: index + 0.999,
      };
      fieldSlots.set(index, [...(fieldSlots.get(index) ?? []), slot]);
    } else {
      firstChange().claims.push(key);
    }
  }

  /** Several field changes of one item read as one line naming it, with the changes listed under it. */
  function groupOf(slots: Slot[]): Slot {
    const index = slots[0].index!;
    const item = after[index];
    return {
      worded: {
        kind: 'changed',
        text: items.nameOf(item, index, after),
        subject: items.subjectOf(item),
        statusText: t('dashboard-scene.review.status.item-changes', '', {
          count: slots.length,
          defaultValue_one: '({{count}} change)',
          defaultValue_other: '({{count}} changes)',
        }),
        changes: slots.map((slot) => ({ ...(slot.inner ?? slot.worded), claims: [] })),
      },
      claims: slots.flatMap((slot) => slot.claims),
      position: slots[0].position,
    };
  }

  function fieldSlotFor(diff: Diff, index: number): Slot | undefined {
    const slots = fieldSlots.get(index);
    if (!slots?.length) {
      return undefined;
    }
    const relative = diff.path.slice(listPath.length + 1);
    const field = relative.length ? items.fieldOf(relative, before[index], after[index]) : undefined;
    return slots.find((slot) => slot.field === field?.key) ?? slots[0];
  }

  return [
    ...addedSlots.values(),
    ...[...fieldSlots.values()].map((slots) => (slots.length > 1 ? groupOf(slots) : slots[0])),
    ...removedSlots.values(),
    ...(reorder ? [reorder] : []),
    ...extra,
  ]
    .sort((a, b) => a.position - b.position)
    .map((slot) => ({ ...slot.worded, claims: slot.claims }));
}

/** The fields of a matched pair that differ, leaving out differences that are only system defaults. */
function changedFields(
  before: unknown,
  after: unknown,
  items: NamedListItems,
  isDefault: (path: string[], value: unknown) => boolean
): ItemField[] {
  if (items.fieldsOf) {
    return items.fieldsOf(before, after).filter((field) => !isEqual(field.read(before), field.read(after)));
  }
  if (typeof before !== 'object' || before === null || typeof after !== 'object' || after === null) {
    return [];
  }
  const fields: ItemField[] = [];
  for (const { op, path, value } of flatDiff(before, after)) {
    if (op === 'add' && isDefault(path, value)) {
      continue;
    }
    if (isUnset(valueAt(before, path)) && isUnset(valueAt(after, path))) {
      continue;
    }
    const field = items.fieldOf(path, before, after);
    if (field && !fields.some((known) => known.key === field.key) && !isEqual(field.read(before), field.read(after))) {
      fields.push(field);
    }
  }
  return fields.sort((a, b) => a.order - b.order || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

function withOccurrence(keys: string[]): string[] {
  const seen = new Map<string, number>();
  return keys.map((key) => {
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    return `${key}#${count}`;
  });
}

/** A removed item sits right after the last baseline item before it that is still there. */
function positionOfRemoved(index: number, beforeKeys: string[], afterIndexByKey: Map<string, number>): number {
  for (let previous = index - 1; previous >= 0; previous--) {
    const afterIndex = afterIndexByKey.get(beforeKeys[previous]);
    if (afterIndex !== undefined) {
      return afterIndex + 0.9 + index / 1e6;
    }
  }
  return -1 + index / 1e6;
}

// --- Show/hide rules ---

type ShowHideOwner = 'row' | 'tab' | 'panel';

/**
 * Words a change of show / hide rules (`conditionalRendering`) in the rules editor's words: one line for the
 * visibility, one for the match rules, and one per rule, rules matched by kind and variable, never by index.
 * `diffs` are the diffs the change claims; each ends up on exactly one line.
 */
export function describeShowHideRules(
  owner: ShowHideOwner,
  before: unknown,
  after: unknown,
  claims: PathKey[],
  diffs: Diff[],
  list: ListContext
): ReviewChange[] {
  const label = t('dashboard-scene.review.field.conditional-rendering', 'Conditional rendering');
  if (isUnset(before) || isUnset(after)) {
    // Progressive disclosure: one line saying a rule set was added or removed, its settings one click away.
    const group = isUnset(before) ? after : before;
    const worded: Worded = {
      ...(isUnset(before) ? added(label) : removed(label)),
      statusText: t('dashboard-scene.review.status.rules', '', {
        count: ruleCount(group),
        defaultValue_one: '({{count}} rule)',
        defaultValue_other: '({{count}} rules)',
      }),
      properties: ruleSetProperties(owner, group),
    };
    return [{ ...worded, claims }];
  }

  const base = basePathOf(claims, diffs);
  const lines: Array<ReviewChange & { key?: string }> = [];
  const visibility = (group: unknown) => valueAt(group, ['spec', 'visibility']);
  const condition = (group: unknown) => valueAt(group, ['spec', 'condition']);
  if (visibility(before) !== visibility(after)) {
    lines.push({
      ...describeValue(visibilityLabel(owner, ruleCount(after)), visibility(before), visibility(after), {
        type: 'name',
        display: displayVisibility,
      }),
      claims: [],
      key: 'visibility',
    });
  }
  if (condition(before) !== condition(after)) {
    lines.push({
      ...describeValue(matchRulesLabel(), condition(before), condition(after), {
        type: 'name',
        display: displayCondition,
      }),
      claims: [],
      key: 'condition',
    });
  }

  const itemsPath = base ? [...base, 'spec', 'items'] : undefined;
  const ruleDiffs = itemsPath ? diffs.filter((diff) => hasPrefix(diff.path, itemsPath)) : [];
  const rules = describeNamedList(
    itemsPath ?? [],
    asArray(valueAt(before, ['spec', 'items'])),
    asArray(valueAt(after, ['spec', 'items'])),
    ruleDiffs,
    ruleItems,
    list
  );
  // An added or removed rule says so. Which way the rules combine decides what it does; that holds for the whole
  // rule set, so it is said once, next to the category label.
  const logic = displayCondition(condition(after));
  lines.push(
    ...rules.map((change) =>
      change.subject === 'rule' && (change.kind === 'added' || change.kind === 'removed')
        ? {
            ...change,
            text:
              change.kind === 'added'
                ? t('dashboard-scene.review.change.rule-added', 'Rule added: {{rule}}', {
                    rule: change.text,
                    interpolation: noEscape,
                  })
                : t('dashboard-scene.review.change.rule-removed', 'Rule removed: {{rule}}', {
                    rule: change.text,
                    interpolation: noEscape,
                  }),
            ...(logic
              ? {
                  categoryNote: t('dashboard-scene.review.status.rule-logic', '({{logic}})', {
                    logic,
                    interpolation: noEscape,
                  }),
                }
              : {}),
          }
        : change
    )
  );

  if (!lines.length) {
    return [{ ...describeValue(label, before, after, { type: 'long' }), claims }];
  }
  assignClaims(
    lines,
    diffs.filter((diff) => !ruleDiffs.includes(diff)).map((diff) => pathKey(diff.path)),
    (path) => (base && path.length > base.length + 1 ? path[base.length + 1] : undefined)
  );
  return lines.map(({ key, ...change }) => change);
}

/** A whole rule set in the rules editor's words, never JSON: visibility, match rules, then one per rule. */
function ruleSetProperties(owner: ShowHideOwner, group: unknown): ReviewProperty[] {
  const items = asArray(valueAt(group, ['spec', 'items']));
  const entry = (label: string, value: string | undefined): ReviewProperty | undefined =>
    value === undefined ? undefined : { label, value };
  return [
    entry(visibilityLabel(owner, items.length), displayVisibility(valueAt(group, ['spec', 'visibility']))),
    entry(matchRulesLabel(), displayCondition(valueAt(group, ['spec', 'condition']))),
    ...items.map((item, index) => entry(ruleItems.nameOf(item, index, items), ruleValue(item))),
  ].filter((item): item is ReviewProperty => item !== undefined);
}

/** The same, as lines of text: what an added element's property list shows behind Show. */
export function ruleSetText(owner: ShowHideOwner, group: unknown): string {
  return ruleSetProperties(owner, group)
    .map(({ label, value }) => lineOf(label, value))
    .join('\n');
}

function lineOf(label: string, value: string | undefined): string {
  return t('dashboard-scene.review.value.rule-line', '{{label}}: {{value}}', { label, value, interpolation: noEscape });
}

const ruleItems: NamedListItems = {
  keyOf: (item) => {
    const kind = String(valueAt(item, ['kind']) ?? '');
    return kind === 'ConditionalRenderingVariable' ? `${kind}:${String(valueAt(item, ['spec', 'variable']))}` : kind;
  },
  nameOf: (item) => {
    switch (valueAt(item, ['kind'])) {
      case 'ConditionalRenderingVariable':
        return t('dashboard-scene.review.item.rule-variable', 'Template variable "{{name}}"', {
          name: String(valueAt(item, ['spec', 'variable']) ?? ''),
          interpolation: noEscape,
        });
      case 'ConditionalRenderingData':
        return t('dashboard.conditional-rendering.conditions.data.label', 'Query result');
      case 'ConditionalRenderingTimeRangeSize':
        return t('dashboard-scene.review.item.rule-time-range', 'Time range less than');
      default:
        return t('dashboard-scene.review.item.rule', 'Rule');
    }
  },
  // A rule is one value: "Template variable "env": Equals "prod" → Matches "prod|staging"".
  fieldOf: () => ({ key: 'rule', label: '', format: { type: 'name' }, order: 0, read: ruleValue }),
  orderLabel: () => t('dashboard-scene.review.item-order.rules', 'Rule order'),
  subjectOf: () => 'rule',
  elementText: (item, index, all) =>
    t('dashboard-scene.review.item.rule-with-value', '{{name}} {{value}}', {
      name: ruleItems.nameOf(item, index, all),
      value: ruleValue(item) ?? '',
      interpolation: noEscape,
    }),
};

function ruleValue(item: unknown): string | undefined {
  const value = valueAt(item, ['spec', 'value']);
  switch (valueAt(item, ['kind'])) {
    case 'ConditionalRenderingVariable':
      return operatorText(valueAt(item, ['spec', 'operator']), String(value ?? ''));
    case 'ConditionalRenderingData':
      return value
        ? t('dashboard.conditional-rendering.conditions.data.enable', 'Has data')
        : t('dashboard.conditional-rendering.conditions.data.disable', 'No data');
    case 'ConditionalRenderingTimeRangeSize':
      return typeof value === 'string' ? (timeRangeLabel(value) ?? value) : undefined;
    default:
      return value === undefined ? undefined : JSON.stringify(value);
  }
}

/** A variable rule's test in the rule editor's words, e.g. `Matches "prod|staging"`. */
function operatorText(operator: unknown, value: string): string {
  return t('dashboard-scene.review.value.rule-operator', '{{operator}} {{value}}', {
    operator: operatorLabel(operator),
    value: quoted(value),
    interpolation: noEscape,
  });
}

function operatorLabel(operator: unknown): string {
  switch (operator) {
    case 'notEquals':
      return t('dashboard.conditional-rendering.conditions.variable.operator.not-equals', 'Not equals');
    case 'matches':
      return t('dashboard.conditional-rendering.conditions.variable.operator.matches', 'Matches');
    case 'notMatches':
      return t('dashboard.conditional-rendering.conditions.variable.operator.not-matches', 'Not matches');
    case 'equals':
    default:
      return t('dashboard.conditional-rendering.conditions.variable.operator.equals', 'Equals');
  }
}

/** The time range rule editor's own labels for its choices. */
function timeRangeLabel(value: string): string | undefined {
  const match = /^(\d+)([mhdMy])$/.exec(value);
  if (!match) {
    return undefined;
  }
  const count = Number(match[1]);
  switch (match[2]) {
    case 'm':
      return t('dashboard.conditional-rendering.conditions.time-range-size.values.minutes', '{{value}} minutes', {
        value: count,
      });
    case 'h':
      return count === 1
        ? t('dashboard.conditional-rendering.conditions.time-range-size.values.hour', '{{value}} hour', {
            value: count,
          })
        : t('dashboard.conditional-rendering.conditions.time-range-size.values.hours', '{{value}} hours', {
            value: count,
          });
    case 'd':
      return t('dashboard.conditional-rendering.conditions.time-range-size.values.days', '{{value}} days', {
        value: count,
      });
    case 'M':
      return t('dashboard.conditional-rendering.conditions.time-range-size.values.months', '{{value}} months', {
        value: count,
      });
    case 'y':
      return count === 1
        ? t('dashboard.conditional-rendering.conditions.time-range-size.values.year', '{{value}} year', {
            value: count,
          })
        : t('dashboard.conditional-rendering.conditions.time-range-size.values.years', '{{value}} years', {
            value: count,
          });
    default:
      return undefined;
  }
}

function ruleCount(group: unknown): number {
  return asArray(valueAt(group, ['spec', 'items'])).length;
}

// With several rules, "Panel visibility: Hide" could read as the item being hidden outright, so the label says it
// applies when the rules match; with a single rule the plain editor label is clear enough.
function visibilityLabel(owner: ShowHideOwner, rules: number): string {
  if (rules > 1) {
    switch (owner) {
      case 'tab':
        return t('dashboard-scene.review.field.tab-visibility-when-rules-match', 'Tab visibility when the rules match');
      case 'panel':
        return t(
          'dashboard-scene.review.field.panel-visibility-when-rules-match',
          'Panel visibility when the rules match'
        );
      case 'row':
      default:
        return t('dashboard-scene.review.field.row-visibility-when-rules-match', 'Row visibility when the rules match');
    }
  }
  switch (owner) {
    case 'tab':
      return t('dashboard-scene.review.field.tab-visibility', 'Tab visibility');
    case 'panel':
      return t('dashboard-scene.review.field.panel-visibility', 'Panel visibility');
    case 'row':
    default:
      return t('dashboard-scene.review.field.row-visibility', 'Row visibility');
  }
}

function matchRulesLabel(): string {
  return t('dashboard-scene.review.field.match-rules', 'Match rules');
}

function displayVisibility(value: unknown): string | undefined {
  switch (value) {
    case 'show':
      return t('dashboard.conditional-rendering.conditions.group.visibility.show', 'Show');
    case 'hide':
      return t('dashboard.conditional-rendering.conditions.group.visibility.hide', 'Hide');
    default:
      return typeof value === 'string' ? value : undefined;
  }
}

function displayCondition(value: unknown): string | undefined {
  switch (value) {
    case 'and':
      return t('dashboard.conditional-rendering.conditions.group.condition.all', 'Match all');
    case 'or':
      return t('dashboard.conditional-rendering.conditions.group.condition.any', 'Match any');
    default:
      return typeof value === 'string' ? value : undefined;
  }
}

/** The path of the `conditionalRendering` value the diffs sit under. */
function basePathOf(claims: PathKey[], diffs: Diff[]): string[] | undefined {
  const segments = diffs[0]?.path ?? claims[0]?.split('/');
  return segments && pathUpTo(segments, 'conditionalRendering');
}
