import { t } from '@grafana/i18n';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { isRecord } from 'app/core/utils/isRecord';

import { humanizeKey, noEscape } from '../richText';
import { layoutKindName } from '../structure/buildStructure';
import { type PathKey, type ReviewProperty } from '../types';

import { escapeSegment, isUnset, valueAt } from './paths';
import { detailOf, type DisplayValue, labels } from './wording';

/**
 * Whether a value at an absolute spec path (escaped segments) is what Grafana fills in for a new element:
 * a schema, serializer or plugin default.
 */
export type IsDefault = (path: string[], value: unknown) => boolean;

export interface PropertyFormat {
  /** Free text typed into a text box: shown in quotes. */
  quoted?: boolean;
  /** How a short value reads, e.g. a plugin id by its name; undefined falls back to the value. */
  display?: DisplayValue;
  /** `false` is listed, as "No", instead of left out. */
  showFalse?: boolean;
}

/** What a property list stays readable with: a longer list of names is shown as JSON instead. */
const MAX_INLINE_NAMES = 5;
const MAX_INLINE_NAME_LENGTH = 40;

/**
 * A value without what Grafana filled in, at any depth: defaults, `false`, and empty values are dropped.
 * Undefined when nothing is left set. Array items stay, so counts and positions keep their meaning.
 */
/**
 * Lists what an element is set to, defaults and `false` included: the fallback when nothing differs from the
 * defaults, so an added or removed element is never left with nothing to show.
 */
export const everything: IsDefault = () => false;

export function withoutDefaults(value: unknown, path: string[], isDefault: IsDefault): unknown {
  if (isUnset(value) || (value === false && isDefault !== everything) || isDefault(path, value)) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map(
      (item, index) => withoutDefaults(item, [...path, String(index)], isDefault) ?? (isRecord(item) ? {} : item)
    );
  }
  if (isRecord(value)) {
    const kept = Object.entries(value).flatMap(([key, item]): Array<[string, unknown]> => {
      const rest = withoutDefaults(item, [...path, escapeSegment(key)], isDefault);
      return rest === undefined ? [] : [[key, rest]];
    });
    return kept.length ? Object.fromEntries(kept) : undefined;
  }
  return value;
}

/**
 * One property line: a literal value next to its label (`Title: "CPU"`, `Max data points: 500`, `Multi-value:
 * Yes`), a few short names inline (`Tags: "prod", "eu"`), and anything else as JSON behind Show, with a count
 * for lists (`Queries (2)`). Undefined when the value isn't set.
 */
export function property(label: string, value: unknown, format: PropertyFormat = {}): ReviewProperty | undefined {
  if (value === false && format.showFalse) {
    return { label, value: t('dashboard-scene.review.property.no', 'No') };
  }
  if (isUnset(value) || value === false) {
    return undefined;
  }
  const shown = format.display?.(value);
  if (shown !== undefined) {
    return { label, value: shown };
  }
  if (typeof value === 'string') {
    if (value.includes('\n')) {
      return { label, details: () => value };
    }
    return { label, value: format.quoted ? quoted(value) : value };
  }
  if (typeof value === 'number') {
    return { label, value: String(value) };
  }
  if (value === true) {
    return { label, value: t('dashboard-scene.review.property.yes', 'Yes') };
  }
  if (Array.isArray(value)) {
    if (isFewShortNames(value)) {
      return {
        label,
        value: t('dashboard-scene.review.property.names', '{{names, list(type: unit; style: short)}}', {
          names: value.map(quoted),
          interpolation: noEscape,
        }),
      };
    }
    return { label: withCount(label, value.length), details: () => detailOf(value) };
  }
  return { label, details: () => detailOf(value) };
}

function isFewShortNames(values: unknown[]): values is string[] {
  return (
    values.length <= MAX_INLINE_NAMES &&
    values.every(
      (value) => typeof value === 'string' && value.length <= MAX_INLINE_NAME_LENGTH && !value.includes('\n')
    )
  );
}

export function quoted(value: string): string {
  return t('dashboard-scene.review.property.quoted', '"{{value}}"', { value, interpolation: noEscape });
}

function withCount(label: string, count: number): string {
  // `total`, not `count`: a list label reads the same for one item or many ("Queries (1)").
  return t('dashboard-scene.review.property.count', '{{label}} ({{total}})', {
    label,
    total: count,
    interpolation: noEscape,
  });
}

interface RecordProperties {
  /** Labels by key; other keys are humanized. */
  labels?: Record<string, string>;
  formats?: Record<string, PropertyFormat>;
  /** Keys already in the header (a name) or not worth listing (values a variable last resolved to). */
  skip?: string[];
}

/** One property per key of a record, in its order, without defaults. `path` is the record's absolute path. */
export function recordProperties(
  record: unknown,
  path: string[],
  isDefault: IsDefault,
  { labels = {}, formats = {}, skip = [] }: RecordProperties = {}
): ReviewProperty[] {
  if (!isRecord(record)) {
    return [];
  }
  return Object.keys(record)
    .filter((key) => !skip.includes(key))
    .map((key) =>
      property(
        Object.hasOwn(labels, key) ? labels[key] : humanizeKey(key),
        withoutDefaults(record[key], [...path, escapeSegment(key)], isDefault),
        { ...(Object.hasOwn(formats, key) ? formats[key] : {}), showFalse: isDefault === everything }
      )
    )
    .filter((item): item is ReviewProperty => item !== undefined);
}

const text: PropertyFormat = { quoted: true };

/** An added or removed panel, read from its own side: what a person set up, in the order the editor shows it. */
export function panelProperties(
  spec: DashboardV2Spec,
  elementName: string,
  itemPath: PathKey | undefined,
  isDefault: IsDefault,
  pluginName: (id: string) => string | undefined,
  rulesText: RulesText
): ReviewProperty[] {
  const base = ['elements', escapeSegment(elementName)];
  const element = valueAt(spec, base);
  const at = (path: string[]) => withoutDefaults(valueAt(element, path), [...base, ...path], isDefault);
  // The title is the header's name: not repeated here.
  const properties: Array<ReviewProperty | undefined> = [];
  if (valueAt(element, ['kind']) === 'LibraryPanel') {
    properties.push(property(labels.libraryPanel(), at(['spec', 'libraryPanel', 'name']), text));
  } else {
    const plugin = valueAt(element, ['spec', 'vizConfig', 'group']);
    properties.push(
      property(labels.description(), at(['spec', 'description']), text),
      property(labels.subtitle(), at(['spec', 'subtitle']), text),
      property(labels.visualization(), plugin, {
        display: (id) => (typeof id === 'string' ? (pluginName(id) ?? id) : undefined),
      }),
      property(t('dashboard-scene.review.property.queries', 'Queries'), at(['spec', 'data', 'spec', 'queries'])),
      property(
        t('dashboard-scene.review.property.transformations', 'Transformations'),
        at(['spec', 'data', 'spec', 'transformations'])
      ),
      property(
        t('dashboard-scene.review.property.query-options', 'Query options'),
        at(['spec', 'data', 'spec', 'queryOptions'])
      ),
      property(t('dashboard-scene.review.property.links', 'Links'), at(['spec', 'links'])),
      property(labels.transparent(), at(['spec', 'transparent'])),
      property(
        t('dashboard-scene.review.category.plugin-options', 'Plugin options'),
        at(['spec', 'vizConfig', 'spec', 'options'])
      ),
      property(labels.fieldConfig(), at(['spec', 'vizConfig', 'spec', 'fieldConfig']))
    );
  }
  properties.push(...layoutItemProperties(spec, itemPath, 'panel', rulesText));
  return properties.filter((item): item is ReviewProperty => item !== undefined);
}

/**
 * An added or removed row or tab, read from its own side. Its title is the header's name. `hasContents` says its
 * toggle reveals something else (panels in it, what moved to it): only without it are its defaults listed.
 */
export function sectionProperties(
  spec: DashboardV2Spec,
  itemPath: PathKey,
  rulesText: RulesText,
  hasContents: boolean,
  all = false
): ReviewProperty[] {
  const item = valueAt(spec, itemPath.split('/'));
  const field = (key: string) => valueAt(item, ['spec', key]);
  const layoutKind = valueAt(item, ['spec', 'layout', 'kind']);
  const isRow = valueAt(item, ['kind']) === 'RowsLayoutRow';
  const flag = { showFalse: all };
  const properties: Array<ReviewProperty | undefined> = [
    isRow ? property(t('dashboard-scene.review.property.collapsed', 'Collapsed'), field('collapse'), flag) : undefined,
    isRow
      ? property(t('dashboard-scene.review.field.hide-header', 'Hide row header'), field('hideHeader'), flag)
      : undefined,
    isRow
      ? property(t('dashboard-scene.review.field.fill-screen', 'Fill screen'), field('fillScreen'), flag)
      : undefined,
    ...layoutItemProperties(spec, itemPath, isRow ? 'row' : 'tab', rulesText),
    // Every new row or tab starts with an auto grid: only another layout says something, unless nothing else does.
    layoutKind === 'AutoGridLayout' && !all
      ? undefined
      : property(t('dashboard-scene.review.field.layout', 'Layout'), layoutKind, {
          display: (kind) => (typeof kind === 'string' ? layoutKindName(kind) : undefined),
        }),
  ];
  const listed = properties.filter((entry): entry is ReviewProperty => entry !== undefined);
  return listed.length || all || hasContents ? listed : sectionProperties(spec, itemPath, rulesText, false, true);
}

/** Repeat and show/hide rules, which live on the layout item (or the row or tab) rather than the element. */
/** A rule set in the rules editor's words, one line each ("Panel visibility: Hide"). */
type RulesText = (owner: 'panel' | 'row' | 'tab', group: unknown) => string;

function layoutItemProperties(
  spec: DashboardV2Spec,
  itemPath: PathKey | undefined,
  owner: 'panel' | 'row' | 'tab',
  rulesText: RulesText
): Array<ReviewProperty | undefined> {
  if (itemPath === undefined) {
    return [];
  }
  const item = valueAt(spec, itemPath.split('/'));
  const rules = valueAt(item, ['spec', 'conditionalRendering']);
  return [
    property(
      t('dashboard-scene.review.field.repeat', 'Repeat by variable'),
      valueAt(item, ['spec', 'repeat', 'value']),
      text
    ),
    // Grafana writes an empty rule group for every item: only rules a person added are worth listing.
    isUnset(valueAt(rules, ['spec', 'items']))
      ? undefined
      : {
          label: t('dashboard-scene.review.field.conditional-rendering', 'Conditional rendering'),
          details: () => rulesText(owner, rules),
        },
  ];
}
