import { t } from '@grafana/i18n';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type ReviewCategory } from '../types';

import { displayAutoRefresh, type DisplayValue, type ValueFormat } from './formatters';
import { displayColorScheme, humanizeKey, humanizePath, isStandardTextFieldConfig, type PanelLabels } from './labels';
import { type NamedListKind } from './listKinds';
import { valueAt } from './paths';

export type Owner = { kind: 'dashboard' } | { kind: 'panel'; element: string };

export type FieldDescriber =
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
}

export interface AttributionContext {
  baseline: DashboardV2Spec;
  payload: DashboardV2Spec;
  /** Option labels of an element's plugin. */
  panelLabels(element: string): PanelLabels;
  /** Translated plugin name, or undefined when the plugin isn't loaded. */
  pluginName(pluginId: string): string | undefined;
}

/** The placeholder plugin of a panel nobody picked a visualization for: reads as "not set". */
export const UNCONFIGURED_PANEL = '__unconfigured-panel';

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
  key: path.join('/'),
  path,
  describe,
});

const rulesByContext = new WeakMap<AttributionContext, { dashboard: Rule[]; panel: (element: string) => Rule[] }>();

/** The rule tables are built once per summary (and per element), not once per diff. */
function rulesFor(ctx: AttributionContext) {
  let rules = rulesByContext.get(ctx);
  if (!rules) {
    const byElement = new Map<string, Rule[]>();
    rules = {
      dashboard: dashboardRules(),
      panel: (element) => {
        let panel = byElement.get(element);
        if (!panel) {
          panel = panelRules(element, ctx);
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
      key: elementPath.join('/'),
      path: elementPath,
      describe: { type: 'libraryConversion', element },
    };
  }
  if (rest[0] !== 'spec') {
    return {
      owner,
      order: UNKNOWN_ORDER,
      ...field('other', untilIndex(fullPath), value(humanizePath(untilIndex(rest)))),
    };
  }
  return applyRules(owner, rulesFor(ctx).panel(element), rest.slice(1), fullPath, () => {
    const path = untilIndex(fullPath);
    return field('other', path, value(humanizePath(path.slice(3))));
  });
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
  const vizTypeChanged = typeChanged(element, ctx);
  const pluginName: DisplayValue = (id) => (typeof id === 'string' ? (ctx.pluginName(id) ?? id) : undefined);
  const visualization = (): Built => ({
    ...field('visualization', at(['vizConfig', 'group']), {
      type: 'value',
      label: labels.visualization(),
      format: { type: 'name', display: pluginName },
      read: (dashboard) => {
        const group = valueAt(dashboard, at(['vizConfig', 'group']));
        // A panel nobody picked a visualization for yet: "Visualization: set to Gauge".
        return group === UNCONFIGURED_PANEL ? undefined : group;
      },
    }),
    order: 0,
  });
  // Values the old visualization had and the new one dropped belong to the Visualization line.
  const droppedByTypeChange = (path: string[]) => vizTypeChanged && valueAt(ctx.payload, path) === undefined;
  const visualizationRule = (pattern: string[]): Rule => ({
    pattern,
    build: () => ({
      ...visualization(),
    }),
  });

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
    visualizationRule(['vizConfig', 'group']),
    // A new type brings its own version: one Visualization line says it all.
    vizTypeChanged
      ? visualizationRule(['vizConfig', 'version'])
      : simple(['vizConfig', 'version'], 'visualization', () => labels.pluginVersion()),
    {
      pattern: ['vizConfig', 'spec', 'options'],
      build: (path) =>
        droppedByTypeChange(path)
          ? visualization()
          : pluginOptionField(at(['vizConfig', 'spec', 'options']), path.slice(6), ctx.panelLabels(element)),
    },
    {
      pattern: ['vizConfig', 'spec', 'fieldConfig', 'defaults'],
      build: (path) =>
        droppedByTypeChange(path)
          ? visualization()
          : fieldConfigField(
              at(['vizConfig', 'spec', 'fieldConfig', 'defaults']),
              path.slice(7),
              ctx.panelLabels(element)
            ),
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

/** Array indexes are never shown: a change inside an array is a change of the array. */
function untilIndex(path: string[]): string[] {
  const index = path.findIndex((segment) => /^\d+$/.test(segment));
  return index === -1 ? path : path.slice(0, index);
}

function elementKindChanged(element: string, ctx: AttributionContext): boolean {
  const before = valueAt(ctx.baseline, ['elements', element, 'kind']);
  const after = valueAt(ctx.payload, ['elements', element, 'kind']);
  return before !== undefined && after !== undefined && before !== after;
}

function typeChanged(element: string, ctx: AttributionContext): boolean {
  const path = ['elements', element, 'spec', 'vizConfig', 'group'];
  const before = valueAt(ctx.baseline, path);
  const after = valueAt(ctx.payload, path);
  return before !== undefined && after !== undefined && before !== after;
}

function matches(pattern: string[], path: string[]): boolean {
  return pattern.length <= path.length && pattern.every((segment, index) => segment === '*' || segment === path[index]);
}

function displayCursorSync(value: unknown): string | undefined {
  switch (value) {
    case 'Off':
      return t('dashboard-scene.review.value.cursor-sync-off', 'Default');
    case 'Crosshair':
      return t('dashboard-scene.review.value.cursor-sync-crosshair', 'Shared crosshair');
    case 'Tooltip':
      return t('dashboard-scene.review.value.cursor-sync-tooltip', 'Shared tooltip');
    default:
      return undefined;
  }
}

export function displayGridKind(value: unknown): string | undefined {
  switch (value) {
    case 'AutoGridLayout':
      return t('dashboard-scene.review.value.grid-auto', 'Auto grid');
    case 'GridLayout':
      return t('dashboard-scene.review.value.grid-custom', 'Custom grid');
    default:
      return undefined;
  }
}

/** Labels of known spec fields. Functions, so they're translated on use rather than at import. */
export const labels = {
  title: () => t('dashboard-scene.review.field.title', 'Title'),
  description: () => t('dashboard-scene.review.field.description', 'Description'),
  subtitle: () => t('dashboard-scene.review.field.subtitle', 'Subtitle'),
  editable: () => t('dashboard-scene.review.field.editable', 'Editable'),
  preload: () => t('dashboard-scene.review.field.preload', 'Preload panels'),
  liveNow: () => t('dashboard-scene.review.field.live-now', 'Refresh live dashboards'),
  cursorSync: () => t('dashboard-scene.review.field.cursor-sync', 'Graph tooltip'),
  defaultGrid: () => t('dashboard-scene.review.field.default-grid', 'Default grid'),
  timeRange: () => t('dashboard-scene.review.field.time-range', 'Default time range'),
  timezone: () => t('dashboard-scene.review.field.timezone', 'Time zone'),
  weekStart: () => t('dashboard-scene.review.field.week-start', 'Week start'),
  autoRefresh: () => t('dashboard-scene.review.field.auto-refresh', 'Auto refresh'),
  autoRefreshIntervals: () => t('dashboard-scene.review.field.auto-refresh-intervals', 'Auto refresh intervals'),
  nowDelay: () => t('dashboard-scene.review.field.now-delay', 'Now delay'),
  hideTimepicker: () => t('dashboard-scene.review.field.hide-timepicker', 'Hide time picker'),
  quickRanges: () => t('dashboard-scene.review.field.quick-ranges', 'Quick ranges'),
  fiscalYearStartMonth: () => t('dashboard-scene.review.field.fiscal-year-start-month', 'Fiscal year start month'),
  transparent: () => t('dashboard-scene.review.field.transparent', 'Transparent background'),
  libraryPanel: () => t('dashboard-scene.review.field.library-panel', 'Library panel'),
  maxDataPoints: () => t('dashboard-scene.review.field.max-data-points', 'Max data points'),
  minInterval: () => t('dashboard-scene.review.field.min-interval', 'Min interval'),
  timeFrom: () => t('dashboard-scene.review.field.time-from', 'Relative time'),
  timeShift: () => t('dashboard-scene.review.field.time-shift', 'Time shift'),
  timeCompare: () => t('dashboard-scene.review.field.time-compare', 'Time comparison'),
  hideTimeOverride: () => t('dashboard-scene.review.field.hide-time-override', 'Hide time info'),
  cacheTimeout: () => t('dashboard-scene.review.field.cache-timeout', 'Cache timeout'),
  queryCachingTTL: () => t('dashboard-scene.review.field.query-caching-ttl', 'Cache TTL'),
  visualization: () => t('dashboard-scene.review.field.visualization', 'Visualization'),
  pluginVersion: () => t('dashboard-scene.review.field.plugin-version', 'Plugin version'),
  options: () => t('dashboard-scene.review.field.options', 'Options'),
  fieldConfig: () => t('dashboard-scene.review.field.field-config', 'Field config'),
};
