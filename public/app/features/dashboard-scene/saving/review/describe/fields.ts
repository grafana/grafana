import { isEqual } from 'lodash';

import { type PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { transformCursorSyncV2ToV1 } from '../../../serialization/transformToV1TypesUtils';
import { getDefaultGridOptions, getGraphTooltipOptions } from '../../../settings/generalSettingsOptions';
import { type Diff } from '../../../settings/version-history/utils';
import { humanizeKey, noEscape } from '../richText';
import { type PathKey, pathKey, type ReviewCategory, type ReviewChange } from '../types';

import { describeNamedList, type ListContext, listItemsOf, type ListKindContext, type NamedListKind } from './lists';
import { asArray, changedOnBothSides, hasPrefix, untilIndex, valueAt } from './paths';
import {
  describeLong,
  describeValue,
  displayAutoRefresh,
  displayColorScheme,
  displayTimeRange,
  type DisplayValue,
  fromTo,
  humanizePath,
  isStandardTextFieldConfig,
  joinLabel,
  labels,
  type PanelLabels,
  type ValueFormat,
} from './wording';

// --- Rules ---

type Owner = { kind: 'dashboard' } | { kind: 'panel'; element: string };

type FieldDescriber =
  /** One value, worded by its format. `read` replaces reading the value at the field's path. */
  | { type: 'value'; label: string; format: ValueFormat; read?: (spec: DashboardV2Spec) => unknown }
  /** The dashboard's default time range: `from` and `to` read as one value. */
  | { type: 'timeRange' }
  /** A list whose items have an identity of their own. */
  | { type: 'namedList'; list: NamedListKind }
  /** `preferences.layout`: its kind, or "changed" when something else inside it changed. */
  | { type: 'defaultGrid' }
  /** A panel converted to or from a library panel. */
  | { type: 'libraryConversion'; element: string };

/** Where a diff belongs: diffs with the same owner and key are described together. */
export interface FieldTarget {
  owner: Owner;
  category: ReviewCategory;
  key: string;
  /** Escaped path whose baseline and payload values the change describes. */
  path: string[];
  /** Order within the category (WORDING.md §9). */
  order: number;
  describe: FieldDescriber;
  /** A whole-value line (a library conversion, a new visualization) takes every diff it implies: none is a default. */
  neverDefault?: boolean;
  /** The new plugin's name, for a field of a panel that switched to it: its defaults read as one line per category. */
  newPluginDefaults?: string;
}

export interface AttributionContext {
  baseline: DashboardV2Spec;
  payload: DashboardV2Spec;
  /** Option labels of an element's plugin. */
  panelLabels(element: string): PanelLabels;
  /** A loaded panel plugin; undefined when it isn't loaded. */
  getPlugin(pluginId: string): PanelPlugin | undefined;
}

/** The placeholder plugin of a panel nobody picked a visualization for: reads as "not set". */
const UNCONFIGURED_PANEL = '__unconfigured-panel';

/** Labels the plugin doesn't know come after the ones it does. */
const UNKNOWN_ORDER = 10_000;
/** Overrides come after the field config defaults. */
const OVERRIDES_ORDER = 20_000;

type Built = Omit<FieldTarget, 'owner' | 'order'> & { order?: number };

type Rule = {
  /** Literal segments; '*' matches any one segment. The diff path must start with the pattern. */
  pattern: string[];
  build: (path: string[]) => Built;
};

/**
 * The ordered rule table: the first rule matching a diff path decides its node, category and field.
 * A path nothing else matches goes to the "Other" category of the nearest node, with a humanized label.
 */
export function attribute(path: string[], ctx: AttributionContext): FieldTarget {
  if (path[0] === 'elements' && path.length > 2) {
    return attributePanel(path[1], path.slice(2), ctx);
  }
  return applyRules({ kind: 'dashboard' }, rulesFor(ctx).dashboard, path, path, () =>
    field('other', untilIndex(path), value(humanizePath(untilIndex(path))))
  );
}

function applyRules(owner: Owner, rules: Rule[], matchPath: string[], fullPath: string[], fallback: () => Built) {
  for (let index = 0; index < rules.length; index++) {
    if (matches(rules[index].pattern, matchPath)) {
      const { order, ...built } = rules[index].build(fullPath);
      return { owner, order: order ?? index, ...built };
    }
  }
  const { order, ...built } = fallback();
  return { owner, order: order ?? UNKNOWN_ORDER, ...built };
}

const value = (label: string, format: ValueFormat = { type: 'auto' }): FieldDescriber => ({
  type: 'value',
  label,
  format,
});

const field = (category: ReviewCategory, path: string[], describe: FieldDescriber): Built => ({
  category,
  key: pathKey(path),
  path,
  describe,
});

interface PanelRules {
  rules: Rule[];
  typeChange?: TypeChange;
}

const rulesByContext = new WeakMap<AttributionContext, { dashboard: Rule[]; panel: (element: string) => PanelRules }>();

/** The rule tables are built once per summary (and per element), not once per diff. */
function rulesFor(ctx: AttributionContext) {
  let rules = rulesByContext.get(ctx);
  if (!rules) {
    const byElement = new Map<string, PanelRules>();
    rules = {
      dashboard: dashboardRules(),
      panel: (element) => {
        let panel = byElement.get(element);
        if (!panel) {
          panel = { rules: panelRules(element, ctx), typeChange: typeChangeOf(element, ctx) };
          byElement.set(element, panel);
        }
        return panel;
      },
    };
    rulesByContext.set(ctx, rules);
  }
  return rules;
}

function dashboardRules(): Rule[] {
  const simple = (key: string, category: ReviewCategory, label: () => string, format?: ValueFormat): Rule => ({
    pattern: [key],
    build: () => field(category, [key], value(label(), format)),
  });
  const timeSetting = (key: string, label: () => string, format?: ValueFormat): Rule => ({
    pattern: ['timeSettings', key],
    build: () => field('controls', ['timeSettings', key], value(label(), format)),
  });
  const timeRange: Rule['build'] = () => ({
    category: 'controls',
    key: 'timeSettings/range',
    path: ['timeSettings'],
    describe: { type: 'timeRange' },
  });
  return [
    simple('title', 'properties', () => labels.title(), { type: 'name', quoted: true }),
    simple('description', 'properties', () => labels.description(), { type: 'freeText', quoted: true }),
    { pattern: ['tags'], build: () => field('properties', ['tags'], { type: 'namedList', list: 'tags' }) },
    simple('editable', 'properties', () => labels.editable(), { type: 'boolean' }),
    simple('preload', 'properties', () => labels.preload(), { type: 'boolean' }),
    simple('liveNow', 'properties', () => labels.liveNow(), { type: 'boolean' }),
    simple('cursorSync', 'properties', () => labels.cursorSync(), { type: 'name', display: displayCursorSync }),
    { pattern: ['preferences'], build: () => field('layout', ['preferences'], { type: 'defaultGrid' }) },
    { pattern: ['variables'], build: () => field('controls', ['variables'], { type: 'namedList', list: 'variables' }) },
    {
      pattern: ['annotations'],
      build: () => field('controls', ['annotations'], { type: 'namedList', list: 'annotations' }),
    },
    { pattern: ['links'], build: () => field('controls', ['links'], { type: 'namedList', list: 'dashboardLinks' }) },
    { pattern: ['timeSettings', 'from'], build: timeRange },
    { pattern: ['timeSettings', 'to'], build: timeRange },
    timeSetting('timezone', () => labels.timezone()),
    timeSetting('weekStart', () => labels.weekStart()),
    timeSetting('autoRefresh', () => labels.autoRefresh(), { type: 'unsetIsValue', display: displayAutoRefresh }),
    timeSetting('autoRefreshIntervals', () => labels.autoRefreshIntervals()),
    timeSetting('nowDelay', () => labels.nowDelay()),
    timeSetting('hideTimepicker', () => labels.hideTimepicker(), { type: 'boolean' }),
    timeSetting('quickRanges', () => labels.quickRanges()),
    timeSetting('fiscalYearStartMonth', () => labels.fiscalYearStartMonth()),
    {
      pattern: ['timeSettings', '*'],
      build: (path) => field('controls', untilIndex(path), value(humanizePath(untilIndex(path).slice(1)))),
    },
  ];
}

function attributePanel(element: string, rest: string[], ctx: AttributionContext): FieldTarget {
  const owner: Owner = { kind: 'panel', element };
  const elementPath = ['elements', element];
  const fullPath = [...elementPath, ...rest];

  if (elementKindChanged(element, ctx)) {
    return {
      owner,
      order: -1,
      category: 'properties',
      key: pathKey(elementPath),
      path: elementPath,
      describe: { type: 'libraryConversion', element },
      neverDefault: true,
    };
  }
  if (rest[0] !== 'spec') {
    return {
      owner,
      order: UNKNOWN_ORDER,
      ...field('other', untilIndex(fullPath), value(humanizePath(untilIndex(rest)))),
    };
  }
  const { rules, typeChange } = rulesFor(ctx).panel(element);
  const target = applyRules(owner, rules, rest.slice(1), fullPath, () => {
    const path = untilIndex(fullPath);
    return field('other', path, value(humanizePath(path.slice(3))));
  });
  return typeChange ? withTypeChange(target, fullPath, typeChange, ctx) : target;
}

function panelRules(element: string, ctx: AttributionContext): Rule[] {
  const spec = ['elements', element, 'spec'];
  const at = (rest: string[]) => [...spec, ...rest];
  const simple = (rest: string[], category: ReviewCategory, label: () => string, format?: ValueFormat): Rule => ({
    pattern: rest,
    build: () => field(category, at(rest), value(label(), format)),
  });
  const queryOption = (key: string, label: () => string): Rule =>
    simple(['data', 'spec', 'queryOptions', key], 'data', label);

  return [
    simple(['title'], 'properties', () => labels.title(), { type: 'name', quoted: true }),
    simple(['description'], 'properties', () => labels.description(), { type: 'freeText', quoted: true }),
    simple(['subtitle'], 'properties', () => labels.subtitle(), { type: 'freeText', quoted: true }),
    { pattern: ['links'], build: () => field('properties', at(['links']), { type: 'namedList', list: 'panelLinks' }) },
    simple(['transparent'], 'properties', () => labels.transparent(), { type: 'boolean' }),
    {
      pattern: ['libraryPanel'],
      build: () =>
        field('properties', at(['libraryPanel']), {
          type: 'value',
          label: labels.libraryPanel(),
          format: { type: 'name', quoted: true },
          read: (dashboard) => valueAt(dashboard, at(['libraryPanel', 'name'])),
        }),
    },
    {
      pattern: ['data', 'spec', 'queries'],
      build: () => field('data', at(['data', 'spec', 'queries']), { type: 'namedList', list: 'queries' }),
    },
    {
      pattern: ['data', 'spec', 'transformations'],
      build: () =>
        field('data', at(['data', 'spec', 'transformations']), { type: 'namedList', list: 'transformations' }),
    },
    queryOption('maxDataPoints', () => labels.maxDataPoints()),
    queryOption('interval', () => labels.minInterval()),
    queryOption('timeFrom', () => labels.timeFrom()),
    queryOption('timeShift', () => labels.timeShift()),
    queryOption('timeCompare', () => labels.timeCompare()),
    queryOption('hideTimeOverride', () => labels.hideTimeOverride()),
    queryOption('cacheTimeout', () => labels.cacheTimeout()),
    queryOption('queryCachingTTL', () => labels.queryCachingTTL()),
    {
      pattern: ['data', 'spec', 'queryOptions', '*'],
      build: (path) => field('data', untilIndex(path).slice(0, 7), value(humanizeKey(path[6]))),
    },
    {
      pattern: ['data'],
      build: (path) => field('data', untilIndex(path), value(humanizePath(untilIndex(path).slice(4)))),
    },
    { pattern: ['vizConfig', 'group'], build: () => visualizationField(element, ctx) },
    simple(['vizConfig', 'version'], 'visualization', () => labels.pluginVersion()),
    {
      pattern: ['vizConfig', 'spec', 'options'],
      build: (path) => pluginOptionField(at(['vizConfig', 'spec', 'options']), path.slice(6), ctx.panelLabels(element)),
    },
    {
      pattern: ['vizConfig', 'spec', 'fieldConfig', 'defaults'],
      build: (path) =>
        fieldConfigField(at(['vizConfig', 'spec', 'fieldConfig', 'defaults']), path.slice(7), ctx.panelLabels(element)),
    },
    {
      pattern: ['vizConfig', 'spec', 'fieldConfig', 'overrides'],
      build: () => ({
        ...field('fieldConfig', at(['vizConfig', 'spec', 'fieldConfig', 'overrides']), {
          type: 'namedList',
          list: 'overrides',
        }),
        order: OVERRIDES_ORDER,
      }),
    },
    {
      pattern: ['vizConfig'],
      build: (path) => field('visualization', untilIndex(path), value(humanizePath(untilIndex(path).slice(4)))),
    },
  ];
}

function visualizationField(element: string, ctx: AttributionContext): Built {
  const group = ['elements', element, 'spec', 'vizConfig', 'group'];
  const pluginName: DisplayValue = (id) => (typeof id === 'string' ? (ctx.getPlugin(id)?.meta?.name ?? id) : undefined);
  return {
    ...field('visualization', group, {
      type: 'value',
      label: labels.visualization(),
      format: { type: 'name', display: pluginName },
      read: (dashboard) => {
        const id = valueAt(dashboard, group);
        // A panel nobody picked a visualization for yet: "Visualization: set to Gauge".
        return id === UNCONFIGURED_PANEL ? undefined : id;
      },
    }),
    order: 0,
  };
}

function pluginOptionField(base: string[], rest: string[], panelLabels: PanelLabels): Built {
  const option = rest.length ? panelLabels.option(rest) : undefined;
  if (option) {
    return {
      ...field(
        'pluginOptions',
        [...base, ...option.path],
        value(option.label, { type: 'auto', display: option.display })
      ),
      order: option.order,
    };
  }
  const path = untilIndex(rest);
  const group = path.length ? panelLabels.optionGroup(path) : undefined;
  return {
    ...field(
      'pluginOptions',
      [...base, ...path],
      value(group?.label ?? (path.length ? humanizePath(path) : labels.options()))
    ),
    order: group?.order ?? UNKNOWN_ORDER,
  };
}

function fieldConfigField(base: string[], rest: string[], panelLabels: PanelLabels): Built {
  const option = rest.length ? panelLabels.fieldConfig(rest) : undefined;
  if (option) {
    return {
      ...field(
        'fieldConfig',
        [...base, ...option.path],
        value(option.label, fieldConfigFormat(option.path, option.display, option.textInput))
      ),
      order: option.order,
    };
  }
  const path = untilIndex(rest);
  const shown = path[0] === 'custom' ? path.slice(1) : path;
  return {
    ...field(
      'fieldConfig',
      [...base, ...path],
      value(shown.length ? humanizePath(shown) : labels.fieldConfig(), fieldConfigFormat(path))
    ),
    order: UNKNOWN_ORDER,
  };
}

/** Thresholds read as steps; other field config values as the editor shows them. */
export function fieldConfigFormat(path: readonly string[], display?: DisplayValue, textInput?: boolean): ValueFormat {
  if (path.length === 1 && path[0] === 'thresholds') {
    return { type: 'thresholds' };
  }
  if (path.length === 1 && path[0] === 'color') {
    return { type: 'name', display: displayColorScheme };
  }
  return { type: 'auto', display, quoted: textInput ?? isStandardTextFieldConfig(path.join('.')) };
}

type Sides = Pick<AttributionContext, 'baseline' | 'payload'>;

function elementKindChanged(element: string, ctx: Sides): boolean {
  return changedOnBothSides(['elements', element, 'kind'], ctx.baseline, ctx.payload);
}

/** Whether a panel switched visualization type. */
export function typeChanged(element: string, ctx: Sides): boolean {
  return changedOnBothSides(['elements', element, 'spec', 'vizConfig', 'group'], ctx.baseline, ctx.payload);
}

/*
 * Visualization type changes. A panel that switched plugin reads as one Visualization line, which takes its group,
 * its version and what the old plugin had that the new one dropped. What the new plugin filled in is weighed
 * against the new plugin's defaults (systemDefaults.ts), and when that plugin is loaded, those defaults read as one
 * line per category: "Plugin options: set to the Gauge defaults". What is left is listed as usual.
 */

interface TypeChange {
  /** The new plugin's name, when it is loaded: only then are its defaults known. */
  newPlugin?: string;
}

function typeChangeOf(element: string, ctx: AttributionContext): TypeChange | undefined {
  if (!typeChanged(element, ctx)) {
    return undefined;
  }
  const id = valueAt(ctx.payload, ['elements', element, 'spec', 'vizConfig', 'group']);
  const plugin = typeof id === 'string' ? ctx.getPlugin(id) : undefined;
  return { newPlugin: plugin ? (plugin.meta?.name ?? String(id)) : undefined };
}

function withTypeChange(
  target: FieldTarget,
  path: string[],
  typeChange: TypeChange,
  ctx: AttributionContext
): FieldTarget {
  const viz = path.slice(3);
  const dropped =
    (hasPrefix(viz, ['vizConfig', 'spec', 'options']) ||
      hasPrefix(viz, ['vizConfig', 'spec', 'fieldConfig', 'defaults'])) &&
    valueAt(ctx.payload, path) === undefined;
  if (dropped || hasPrefix(viz, ['vizConfig', 'group']) || hasPrefix(viz, ['vizConfig', 'version'])) {
    return { ...visualizationField(path[1], ctx), owner: target.owner, order: 0, neverDefault: true };
  }
  const ownDefaults =
    target.category === 'pluginOptions' || (target.category === 'fieldConfig' && target.describe.type !== 'namedList');
  return ownDefaults && typeChange.newPlugin ? { ...target, newPluginDefaults: typeChange.newPlugin } : target;
}

/** The one line a new plugin's defaults in `category` read as. */
export function describeNewPluginDefaults(category: ReviewCategory, name: string, claims: PathKey[]): ReviewChange {
  const text =
    category === 'pluginOptions'
      ? t('dashboard-scene.review.default.plugin-options', 'Plugin options: set to the {{name}} defaults', {
          name,
          interpolation: noEscape,
        })
      : t('dashboard-scene.review.default.field-config', 'Field config: set to the {{name}} defaults', {
          name,
          interpolation: noEscape,
        });
  return { kind: 'changed', text, claims };
}

function matches(pattern: string[], path: string[]): boolean {
  return pattern.length <= path.length && pattern.every((segment, index) => segment === '*' || segment === path[index]);
}

/** The settings view's names for the graph tooltip choices. */
function displayCursorSync(value: unknown): string | undefined {
  if (value !== 'Off' && value !== 'Crosshair' && value !== 'Tooltip') {
    return undefined;
  }
  const sync = transformCursorSyncV2ToV1(value);
  return getGraphTooltipOptions().find((option) => option.value === sync)?.label;
}

/** The settings view's names for the default grid choices. */
function displayGridKind(value: unknown): string | undefined {
  return getDefaultGridOptions().find((option) => option.value === value)?.label;
}

// --- Describing fields ---

export interface DescribeContext {
  baseline: DashboardV2Spec;
  payload: DashboardV2Spec;
  list: ListContext;
  listKind(target: FieldTarget): ListKindContext;
}

/** Words the diffs of one field (or one named list) as review changes, each claiming the diffs it accounts for. */
export function describeField(target: FieldTarget, diffs: Diff[], ctx: DescribeContext): ReviewChange[] {
  const claims = diffs.map((diff) => pathKey(diff.path));
  const { describe } = target;
  switch (describe.type) {
    case 'timeRange': {
      const range = (spec: DashboardV2Spec) => displayTimeRange(spec.timeSettings?.from, spec.timeSettings?.to);
      return [{ kind: 'changed', text: fromTo(labels.timeRange(), range(ctx.baseline), range(ctx.payload)), claims }];
    }
    case 'namedList': {
      const before = asArray(valueAt(ctx.baseline, target.path));
      const after = asArray(valueAt(ctx.payload, target.path));
      const items = listItemsOf(describe.list, ctx.listKind(target));
      return describeNamedList(target.path, before, after, diffs, items, ctx.list);
    }
    case 'defaultGrid': {
      const kindPath = ['preferences', 'layout', 'kind'];
      const before = valueAt(ctx.baseline, kindPath);
      const after = valueAt(ctx.payload, kindPath);
      if (before !== after) {
        const worded = describeValue(labels.defaultGrid(), before, after, { type: 'name', display: displayGridKind });
        return [{ ...worded, claims }];
      }
      const layout = ['preferences', 'layout'];
      return [
        { ...describeLong(labels.defaultGrid(), valueAt(ctx.baseline, layout), valueAt(ctx.payload, layout)), claims },
      ];
    }
    case 'libraryConversion': {
      const name = (spec: DashboardV2Spec) =>
        valueAt(spec, ['elements', describe.element, 'spec', 'libraryPanel', 'name']);
      const toLibrary = valueAt(ctx.payload, ['elements', describe.element, 'kind']) === 'LibraryPanel';
      const text = toLibrary
        ? t('dashboard-scene.review.change.library-converted', 'Converted to library panel "{{name}}"', {
            name: String(name(ctx.payload) ?? ''),
            interpolation: noEscape,
          })
        : t('dashboard-scene.review.change.library-unlinked', 'Unlinked from library panel "{{name}}"', {
            name: String(name(ctx.baseline) ?? ''),
            interpolation: noEscape,
          });
      return [{ kind: 'changed', text, claims }];
    }
    case 'value':
    default: {
      const read = describe.read ?? ((spec: DashboardV2Spec) => valueAt(spec, target.path));
      const before = read(ctx.baseline);
      const after = read(ctx.payload);
      if (describe.read && isEqual(before, after)) {
        // What `read` shows didn't change (e.g. a library panel's uid): show the whole value instead.
        const whole = describeLong(
          describe.label,
          valueAt(ctx.baseline, target.path),
          valueAt(ctx.payload, target.path)
        );
        return [{ ...whole, claims }];
      }
      return [{ ...describeValue(describe.label, before, after, describe.format), claims }];
    }
  }
}

/** Words a system default the payload fills in (WORDING.md §10), with the same phrasing as any other change. */
export function describeDefaultDiff(target: FieldTarget, diff: Diff, ctx: DescribeContext): ReviewChange {
  const { label, format } = defaultField(target, diff, ctx);
  const before = valueAt(ctx.baseline, diff.path);
  return { ...describeValue(label, before, valueAt(ctx.payload, diff.path), format), claims: [pathKey(diff.path)] };
}

function defaultField(target: FieldTarget, diff: Diff, ctx: DescribeContext): { label: string; format: ValueFormat } {
  const { describe } = target;
  const below = diff.path.slice(target.path.length);
  const auto: ValueFormat = { type: 'auto' };
  switch (describe.type) {
    case 'value':
      return { label: describe.label, format: below.length ? auto : describe.format };
    case 'namedList': {
      const items = listItemsOf(describe.list, ctx.listKind(target));
      const after = asArray(valueAt(ctx.payload, target.path));
      const index = Number(below[0]);
      if (!Number.isInteger(index) || after[index] === undefined) {
        return { label: humanizePath(target.path.slice(-1)), format: auto };
      }
      const name = items.nameOf(after[index], index, after);
      const inner = below.slice(1);
      const field = inner.length ? items.fieldOf(inner, undefined, after[index]) : undefined;
      return field ? { label: joinLabel([name, field.label]), format: field.format } : { label: name, format: auto };
    }
    case 'timeRange':
      return { label: labels.timeRange(), format: auto };
    case 'defaultGrid':
      return { label: labels.defaultGrid(), format: auto };
    default:
      return { label: humanizePath(diff.path), format: auto };
  }
}
