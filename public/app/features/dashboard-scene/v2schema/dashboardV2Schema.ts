/**
 * Canonical Zod schemas for the Dashboard v2 (stable) spec.
 *
 * These mirror the v2 CUE (`apps/dashboard/kinds/v2/dashboard_spec.cue`) and are
 * the single structural source of truth for the v2 DashboardSpec on the
 * frontend. Each schema is verified against its generated TypeScript interface
 * with `satisfies z.ZodType<...>`, so the two cannot drift silently.
 *
 * CUE `*value` defaults are generated as required fields on the TS types, so
 * they are encoded here via `.optional().default(...)`: input may omit them,
 * output always has them present (which is what keeps `satisfies` happy).
 *
 * Array fields tolerate the `null` that Go emits for empty (nil) slices via
 * {@link nullableArray}. Fields that CUE leaves open (`[string]: _`, `_`,
 * `{...}`) stay permissive (`z.record(z.string(), z.unknown())` / `z.unknown()`)
 * so datasource- and plugin-specific content survives a round-trip.
 *
 * Objects are non-strict (unknown keys are stripped, not rejected) to stay
 * forward-compatible with newer schema fields.
 */

import { z } from 'zod';

import type {
  Spec as DashboardV2Spec,
  AnnotationQueryKind,
  AnnotationPanelFilter,
  AnnotationEventFieldMapping,
  DataQueryKind,
  PanelKind,
  PanelQueryKind,
  TransformationKind,
  QueryGroupKind,
  QueryOptionsSpec,
  VizConfigKind,
  FieldConfigSource,
  LibraryPanelKind,
  Element as DashboardElement,
  ElementReference,
  GridLayoutKind,
  GridLayoutItemKind,
  RowsLayoutKind,
  RowsLayoutRowKind,
  AutoGridLayoutKind,
  AutoGridLayoutItemKind,
  TabsLayoutKind,
  TabsLayoutTabKind,
  ConditionalRenderingGroupKind,
  ConditionalRenderingVariableKind,
  ConditionalRenderingDataKind,
  ConditionalRenderingTimeRangeSizeKind,
  VariableKind,
  VariableOption,
  MetricFindValue,
  AdHocFilterWithLabels,
  ControlSourceRef,
  DashboardLink,
  TimeSettingsSpec,
  TimeRangeOption,
  Preferences,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

/**
 * Array field that tolerates the JSON shapes Go produces for slices: a present
 * array, `null` (marshaled nil slice), or an omitted key all normalize to the
 * element list (empty when absent/null). Implemented with `z.preprocess` (not a
 * trailing `.transform`) so the element schema is preserved: elements are still
 * validated, `satisfies z.ZodType<...>` holds, and `z.toJSONSchema` still emits
 * a proper `array` type (a trailing transform would collapse it to `any`).
 */
function nullableArray<T extends z.ZodTypeAny>(element: T) {
  return z.preprocess((value) => (value == null ? [] : value), z.array(element));
}

// ---------------------------------------------------------------------------
// Shared leaves
// ---------------------------------------------------------------------------

const controlSourceRefSchema = z.object({
  type: z.literal('datasource'),
  group: z.string(),
}) satisfies z.ZodType<ControlSourceRef>;

const elementReferenceSchema = z.object({
  kind: z.literal('ElementReference'),
  name: z.string(),
}) satisfies z.ZodType<ElementReference>;

const datasourceRefSchema = z.object({ name: z.string().optional() });

const dataQueryKindSchema = z.object({
  // Not a discriminated-union member, so defaulting the constant kind keeps the
  // output faithful to the type while tolerating payloads that omit it.
  kind: z.literal('DataQuery').optional().default('DataQuery'),
  group: z.string(),
  version: z.string().optional().default('v0'),
  labels: z.record(z.string(), z.string()).optional(),
  datasource: datasourceRefSchema.optional(),
  spec: z.record(z.string(), z.unknown()),
}) satisfies z.ZodType<DataQueryKind>;

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------

const variableOptionSchema = z.object({
  selected: z.boolean().optional(),
  text: z.union([z.string(), z.array(z.string())]),
  value: z.union([z.string(), z.array(z.string())]),
  properties: z.record(z.string(), z.string()).optional(),
}) satisfies z.ZodType<VariableOption>;

const variableHideSchema = z.enum(['dontHide', 'hideLabel', 'hideVariable', 'inControlsMenu']);
// `.catch(...)` absorbs an unknown/invalid enum value (not just a missing one,
// which `.default(...)` at the usage already handles) by falling back to the
// canonical default. These enums have unambiguous CUE-generated defaults, so a
// bad value from an authoring caller should not fail the whole mutation.
const variableRefreshSchema = z.enum(['never', 'onDashboardLoad', 'onTimeRangeChanged']).catch('never');
const variableSortSchema = z
  .enum([
    'disabled',
    'alphabeticalAsc',
    'alphabeticalDesc',
    'numericalAsc',
    'numericalDesc',
    'alphabeticalCaseInsensitiveAsc',
    'alphabeticalCaseInsensitiveDesc',
    'naturalAsc',
    'naturalDesc',
  ])
  .catch('disabled');
const variableRegexApplyToSchema = z.enum(['value', 'text']);

const defaultVariableOptionValue = { text: '', value: '' };

const metricFindValueSchema = z.object({
  text: z.string(),
  value: z.union([z.string(), z.number()]).optional(),
  group: z.string().optional(),
  expandable: z.boolean().optional(),
}) satisfies z.ZodType<MetricFindValue>;

const adHocFilterWithLabelsSchema = z.object({
  key: z.string(),
  operator: z.string(),
  value: z.string(),
  values: nullableArray(z.string()).optional(),
  keyLabel: z.string().optional(),
  valueLabels: nullableArray(z.string()).optional(),
  forceEdit: z.boolean().optional(),
  origin: z.literal('dashboard').optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<AdHocFilterWithLabels>;

const queryVariableKindSchema = z.object({
  kind: z.literal('QueryVariable'),
  spec: z.object({
    name: z.string().optional().default(''),
    current: variableOptionSchema.optional().default(defaultVariableOptionValue),
    label: z.string().optional(),
    hide: variableHideSchema.optional().default('dontHide'),
    refresh: variableRefreshSchema.optional().default('never'),
    skipUrlSync: z.boolean().optional().default(false),
    description: z.string().optional(),
    query: dataQueryKindSchema,
    regex: z.string().optional().default(''),
    regexApplyTo: variableRegexApplyToSchema.optional(),
    sort: variableSortSchema.optional().default('disabled'),
    definition: z.string().optional(),
    options: nullableArray(variableOptionSchema),
    multi: z.boolean().optional().default(false),
    includeAll: z.boolean().optional().default(false),
    allValue: z.string().optional(),
    placeholder: z.string().optional(),
    allowCustomValue: z.boolean().optional().default(true),
    staticOptions: nullableArray(variableOptionSchema).optional(),
    staticOptionsOrder: z.enum(['before', 'after', 'sorted']).optional(),
    origin: controlSourceRefSchema.optional(),
  }),
});

const textVariableKindSchema = z.object({
  kind: z.literal('TextVariable'),
  spec: z.object({
    name: z.string().optional().default(''),
    current: variableOptionSchema.optional().default(defaultVariableOptionValue),
    query: z.string().optional().default(''),
    label: z.string().optional(),
    hide: variableHideSchema.optional().default('dontHide'),
    skipUrlSync: z.boolean().optional().default(false),
    description: z.string().optional(),
    origin: controlSourceRefSchema.optional(),
  }),
});

const constantVariableKindSchema = z.object({
  kind: z.literal('ConstantVariable'),
  spec: z.object({
    name: z.string().optional().default(''),
    query: z.string().optional().default(''),
    current: variableOptionSchema.optional().default(defaultVariableOptionValue),
    label: z.string().optional(),
    hide: variableHideSchema.optional().default('dontHide'),
    skipUrlSync: z.boolean().optional().default(false),
    description: z.string().optional(),
    origin: controlSourceRefSchema.optional(),
  }),
});

const datasourceVariableKindSchema = z.object({
  kind: z.literal('DatasourceVariable'),
  spec: z.object({
    name: z.string().optional().default(''),
    pluginId: z.string().optional().default(''),
    refresh: variableRefreshSchema.optional().default('never'),
    regex: z.string().optional().default(''),
    current: variableOptionSchema.optional().default(defaultVariableOptionValue),
    options: nullableArray(variableOptionSchema),
    multi: z.boolean().optional().default(false),
    includeAll: z.boolean().optional().default(false),
    allValue: z.string().optional(),
    label: z.string().optional(),
    hide: variableHideSchema.optional().default('dontHide'),
    skipUrlSync: z.boolean().optional().default(false),
    description: z.string().optional(),
    allowCustomValue: z.boolean().optional().default(true),
    origin: controlSourceRefSchema.optional(),
  }),
});

const intervalVariableKindSchema = z.object({
  kind: z.literal('IntervalVariable'),
  spec: z.object({
    name: z.string().optional().default(''),
    query: z.string().optional().default(''),
    current: variableOptionSchema.optional().default(defaultVariableOptionValue),
    options: nullableArray(variableOptionSchema),
    auto: z.boolean().optional().default(false),
    auto_min: z.string().optional().default(''),
    auto_count: z.number().optional().default(0),
    refresh: z.literal('onTimeRangeChanged').optional().default('onTimeRangeChanged'),
    label: z.string().optional(),
    hide: variableHideSchema.optional().default('dontHide'),
    skipUrlSync: z.boolean().optional().default(false),
    description: z.string().optional(),
    origin: controlSourceRefSchema.optional(),
  }),
});

const customVariableKindSchema = z.object({
  kind: z.literal('CustomVariable'),
  spec: z.object({
    name: z.string().optional().default(''),
    query: z.string().optional().default(''),
    current: variableOptionSchema.optional().default(defaultVariableOptionValue),
    options: nullableArray(variableOptionSchema),
    multi: z.boolean().optional().default(false),
    includeAll: z.boolean().optional().default(false),
    allValue: z.string().optional(),
    label: z.string().optional(),
    hide: variableHideSchema.optional().default('dontHide'),
    skipUrlSync: z.boolean().optional().default(false),
    description: z.string().optional(),
    allowCustomValue: z.boolean().optional().default(true),
    valuesFormat: z.enum(['csv', 'json']).optional(),
    origin: controlSourceRefSchema.optional(),
  }),
});

const groupByVariableKindSchema = z.object({
  kind: z.literal('GroupByVariable'),
  group: z.string(),
  labels: z.record(z.string(), z.string()).optional(),
  datasource: datasourceRefSchema.optional(),
  spec: z.object({
    name: z.string().optional().default(''),
    defaultValue: variableOptionSchema.optional(),
    current: variableOptionSchema.optional().default(defaultVariableOptionValue),
    options: nullableArray(variableOptionSchema),
    multi: z.boolean().optional().default(false),
    label: z.string().optional(),
    hide: variableHideSchema.optional().default('dontHide'),
    skipUrlSync: z.boolean().optional().default(false),
    description: z.string().optional(),
    origin: controlSourceRefSchema.optional(),
  }),
});

const adhocVariableKindSchema = z.object({
  kind: z.literal('AdhocVariable'),
  group: z.string(),
  labels: z.record(z.string(), z.string()).optional(),
  datasource: datasourceRefSchema.optional(),
  spec: z.object({
    name: z.string().optional().default(''),
    baseFilters: nullableArray(adHocFilterWithLabelsSchema),
    filters: nullableArray(adHocFilterWithLabelsSchema),
    defaultKeys: nullableArray(metricFindValueSchema),
    label: z.string().optional(),
    hide: variableHideSchema.optional().default('dontHide'),
    skipUrlSync: z.boolean().optional().default(false),
    description: z.string().optional(),
    allowCustomValue: z.boolean().optional().default(true),
    enableGroupBy: z.boolean().optional(),
    origin: controlSourceRefSchema.optional(),
  }),
});

const switchVariableKindSchema = z.object({
  kind: z.literal('SwitchVariable'),
  spec: z.object({
    name: z.string().optional().default(''),
    current: z.string().optional().default('false'),
    enabledValue: z.string().optional().default('true'),
    disabledValue: z.string().optional().default('false'),
    label: z.string().optional(),
    hide: variableHideSchema.optional().default('dontHide'),
    skipUrlSync: z.boolean().optional().default(false),
    description: z.string().optional(),
    origin: controlSourceRefSchema.optional(),
  }),
});

export const variableKindSchema = z.discriminatedUnion('kind', [
  queryVariableKindSchema,
  textVariableKindSchema,
  constantVariableKindSchema,
  datasourceVariableKindSchema,
  intervalVariableKindSchema,
  customVariableKindSchema,
  groupByVariableKindSchema,
  adhocVariableKindSchema,
  switchVariableKindSchema,
]) satisfies z.ZodType<VariableKind>;

// ---------------------------------------------------------------------------
// Annotations
// ---------------------------------------------------------------------------

const annotationPanelFilterSchema = z.object({
  exclude: z.boolean().optional(),
  ids: nullableArray(z.number()),
}) satisfies z.ZodType<AnnotationPanelFilter>;

const annotationEventFieldMappingSchema = z.object({
  source: z.string().optional(),
  value: z.string().optional(),
  regex: z.string().optional(),
}) satisfies z.ZodType<AnnotationEventFieldMapping>;

export const annotationQueryKindSchema = z.object({
  // Not a discriminated-union member; default the constant kind so a payload can
  // omit it (annotations are a plain array, not a discriminated union).
  kind: z.literal('AnnotationQuery').optional().default('AnnotationQuery'),
  spec: z.object({
    query: dataQueryKindSchema,
    enable: z.boolean().optional().default(true),
    hide: z.boolean().optional().default(false),
    iconColor: z.string().optional().default('red'),
    name: z.string(),
    builtIn: z.boolean().optional(),
    filter: annotationPanelFilterSchema.optional(),
    placement: z.literal('inControlsMenu').optional(),
    mappings: z.record(z.string(), annotationEventFieldMappingSchema).optional(),
    legacyOptions: z.record(z.string(), z.unknown()).optional(),
  }),
}) satisfies z.ZodType<AnnotationQueryKind>;

// ---------------------------------------------------------------------------
// Conditional rendering
// ---------------------------------------------------------------------------

const conditionalRenderingVariableKindSchema = z.object({
  kind: z.literal('ConditionalRenderingVariable'),
  spec: z.object({
    variable: z.string(),
    operator: z.enum(['equals', 'notEquals', 'matches', 'notMatches']),
    value: z.string(),
  }),
}) satisfies z.ZodType<ConditionalRenderingVariableKind>;

const conditionalRenderingDataKindSchema = z.object({
  kind: z.literal('ConditionalRenderingData'),
  spec: z.object({ value: z.boolean() }),
}) satisfies z.ZodType<ConditionalRenderingDataKind>;

const conditionalRenderingTimeRangeSizeKindSchema = z.object({
  kind: z.literal('ConditionalRenderingTimeRangeSize'),
  spec: z.object({ value: z.string() }),
}) satisfies z.ZodType<ConditionalRenderingTimeRangeSizeKind>;

const conditionalRenderingGroupKindSchema = z.object({
  kind: z.literal('ConditionalRenderingGroup'),
  spec: z.object({
    // Tolerate a missing/invalid value by defaulting to the canonical 'show'.
    visibility: z.enum(['show', 'hide']).catch('show'),
    condition: z.enum(['and', 'or']),
    items: nullableArray(
      z.discriminatedUnion('kind', [
        conditionalRenderingVariableKindSchema,
        conditionalRenderingDataKindSchema,
        conditionalRenderingTimeRangeSizeKindSchema,
      ])
    ),
  }),
}) satisfies z.ZodType<ConditionalRenderingGroupKind>;

// ---------------------------------------------------------------------------
// Panel (query stack + viz config)
// ---------------------------------------------------------------------------

const dataLinkSchema = z.object({
  title: z.string(),
  url: z.string(),
  targetBlank: z.boolean().optional(),
});

const panelQueryKindSchema = z.object({
  kind: z.literal('PanelQuery'),
  spec: z.object({
    query: dataQueryKindSchema,
    refId: z.string().optional().default('A'),
    hidden: z.boolean().optional().default(false),
  }),
}) satisfies z.ZodType<PanelQueryKind>;

const matcherConfigSchema = z.object({
  id: z.string().optional().default(''),
  scope: z.enum(['series', 'nested', 'annotation', 'exemplar']).optional(),
  options: z.unknown().optional(),
});

const transformationKindSchema = z.object({
  kind: z.literal('Transformation'),
  group: z.string(),
  spec: z.object({
    disabled: z.boolean().optional(),
    filter: matcherConfigSchema.optional(),
    topic: z.enum(['series', 'annotations', 'alertStates']).optional(),
    options: z.unknown(),
  }),
}) satisfies z.ZodType<TransformationKind>;

const queryOptionsSpecSchema = z.object({
  timeFrom: z.string().optional(),
  maxDataPoints: z.number().optional(),
  timeShift: z.string().optional(),
  queryCachingTTL: z.number().optional(),
  interval: z.string().optional(),
  cacheTimeout: z.string().optional(),
  hideTimeOverride: z.boolean().optional(),
  timeCompare: z.string().optional(),
}) satisfies z.ZodType<QueryOptionsSpec>;

const queryGroupKindSchema = z.object({
  kind: z.literal('QueryGroup'),
  spec: z.object({
    queries: nullableArray(panelQueryKindSchema),
    transformations: nullableArray(transformationKindSchema),
    queryOptions: queryOptionsSpecSchema,
  }),
}) satisfies z.ZodType<QueryGroupKind>;

// FieldConfigSource is kept faithful but permissive: `defaults` is an open bag
// (panel-plugin field config), and override `properties` carry arbitrary values.
const fieldConfigSourceSchema = z.object({
  defaults: z.record(z.string(), z.unknown()),
  overrides: nullableArray(
    z.object({
      __systemRef: z.string().optional(),
      matcher: matcherConfigSchema,
      properties: nullableArray(z.object({ id: z.string(), value: z.unknown().optional() })),
    })
  ),
}) satisfies z.ZodType<FieldConfigSource>;

const vizConfigKindSchema = z.object({
  kind: z.literal('VizConfig'),
  group: z.string(),
  // The panel plugin version is runtime metadata (used only for panel
  // migrations) and is stamped from the running plugin when absent, so an
  // authoring caller need not supply it. Optional here; the scene transform
  // treats an empty value as "current version".
  version: z.string().optional().default(''),
  spec: z.object({
    // `transformSceneToSaveModelSchemaV2` passes `vizPanel.state.options` through
    // verbatim, which is `undefined` for a panel that never set options. Normalize
    // to `{}` so validating serialized output doesn't reject what GET_SPEC returns.
    options: z.preprocess((value) => (value == null ? {} : value), z.record(z.string(), z.unknown())),
    fieldConfig: fieldConfigSourceSchema,
  }),
}) satisfies z.ZodType<VizConfigKind>;

const panelKindSchema = z.object({
  kind: z.literal('Panel'),
  spec: z.object({
    id: z.number(),
    title: z.string(),
    description: z.string().optional(),
    subtitle: z.string().optional(),
    links: nullableArray(dataLinkSchema),
    data: queryGroupKindSchema,
    vizConfig: vizConfigKindSchema,
    transparent: z.boolean().optional(),
  }),
}) satisfies z.ZodType<PanelKind>;

const libraryPanelKindSchema = z.object({
  kind: z.literal('LibraryPanel'),
  spec: z.object({
    id: z.number(),
    title: z.string(),
    libraryPanel: z.object({ name: z.string(), uid: z.string() }),
  }),
}) satisfies z.ZodType<LibraryPanelKind>;

const elementSchema = z.discriminatedUnion('kind', [
  panelKindSchema,
  libraryPanelKindSchema,
]) satisfies z.ZodType<DashboardElement>;

// ---------------------------------------------------------------------------
// Layout (recursive)
// ---------------------------------------------------------------------------

type AnyLayoutKind = GridLayoutKind | RowsLayoutKind | AutoGridLayoutKind | TabsLayoutKind;

const repeatOptionsSchema = z.object({
  mode: z.literal('variable'),
  value: z.string(),
  direction: z.enum(['h', 'v']).optional(),
  maxPerRow: z.number().optional(),
});

const rowRepeatOptionsSchema = z.object({ mode: z.literal('variable'), value: z.string() });
const tabRepeatOptionsSchema = z.object({ mode: z.literal('variable'), value: z.string() });
const autoGridRepeatOptionsSchema = z.object({ mode: z.literal('variable'), value: z.string() });

const gridLayoutItemKindSchema = z.object({
  kind: z.literal('GridLayoutItem'),
  spec: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    element: elementReferenceSchema,
    repeat: repeatOptionsSchema.optional(),
  }),
}) satisfies z.ZodType<GridLayoutItemKind>;

const gridLayoutKindSchema = z.object({
  kind: z.literal('GridLayout'),
  spec: z.object({ items: nullableArray(gridLayoutItemKindSchema) }),
}) satisfies z.ZodType<GridLayoutKind>;

const autoGridLayoutItemKindSchema = z.object({
  kind: z.literal('AutoGridLayoutItem'),
  spec: z.object({
    element: elementReferenceSchema,
    repeat: autoGridRepeatOptionsSchema.optional(),
    conditionalRendering: conditionalRenderingGroupKindSchema.optional(),
  }),
}) satisfies z.ZodType<AutoGridLayoutItemKind>;

const autoGridLayoutKindSchema = z.object({
  kind: z.literal('AutoGridLayout'),
  spec: z.object({
    maxColumnCount: z.number().optional(),
    columnWidthMode: z.enum(['narrow', 'standard', 'wide', 'custom']).optional().default('standard'),
    columnWidth: z.number().optional(),
    rowHeightMode: z.enum(['short', 'standard', 'tall', 'custom']).optional().default('standard'),
    rowHeight: z.number().optional(),
    fillScreen: z.boolean().optional(),
    items: nullableArray(autoGridLayoutItemKindSchema),
  }),
}) satisfies z.ZodType<AutoGridLayoutKind>;

const rowsLayoutRowKindSchema = z.object({
  kind: z.literal('RowsLayoutRow'),
  spec: z.object({
    title: z.string().optional(),
    collapse: z.boolean().optional(),
    hideHeader: z.boolean().optional(),
    fillScreen: z.boolean().optional(),
    conditionalRendering: conditionalRenderingGroupKindSchema.optional(),
    repeat: rowRepeatOptionsSchema.optional(),
    layout: z.lazy((): z.ZodType<AnyLayoutKind> => layoutKindSchema),
    variables: nullableArray(variableKindSchema).optional(),
  }),
}) satisfies z.ZodType<RowsLayoutRowKind>;

const rowsLayoutKindSchema = z.object({
  kind: z.literal('RowsLayout'),
  spec: z.object({ rows: nullableArray(rowsLayoutRowKindSchema) }),
}) satisfies z.ZodType<RowsLayoutKind>;

const tabsLayoutTabKindSchema = z.object({
  kind: z.literal('TabsLayoutTab'),
  spec: z.object({
    title: z.string().optional(),
    layout: z.lazy((): z.ZodType<AnyLayoutKind> => layoutKindSchema),
    conditionalRendering: conditionalRenderingGroupKindSchema.optional(),
    repeat: tabRepeatOptionsSchema.optional(),
    variables: nullableArray(variableKindSchema).optional(),
  }),
}) satisfies z.ZodType<TabsLayoutTabKind>;

const tabsLayoutKindSchema = z.object({
  kind: z.literal('TabsLayout'),
  spec: z.object({ tabs: nullableArray(tabsLayoutTabKindSchema) }),
}) satisfies z.ZodType<TabsLayoutKind>;

const layoutKindSchema: z.ZodType<AnyLayoutKind> = z.discriminatedUnion('kind', [
  gridLayoutKindSchema,
  rowsLayoutKindSchema,
  autoGridLayoutKindSchema,
  tabsLayoutKindSchema,
]);

// ---------------------------------------------------------------------------
// Settings / links / preferences
// ---------------------------------------------------------------------------

const dashboardLinkSchema = z.object({
  title: z.string(),
  type: z.enum(['link', 'dashboards']).optional().default('link'),
  icon: z.string().optional().default(''),
  tooltip: z.string().optional().default(''),
  url: z.string().optional(),
  tags: nullableArray(z.string()),
  asDropdown: z.boolean().optional().default(false),
  targetBlank: z.boolean().optional().default(false),
  includeVars: z.boolean().optional().default(false),
  keepTime: z.boolean().optional().default(false),
  placement: z.literal('inControlsMenu').optional(),
  origin: controlSourceRefSchema.optional(),
}) satisfies z.ZodType<DashboardLink>;

const timeRangeOptionSchema = z.object({
  display: z.string().optional().default('Last 6 hours'),
  from: z.string().optional().default('now-6h'),
  to: z.string().optional().default('now'),
}) satisfies z.ZodType<TimeRangeOption>;

const timeSettingsSpecSchema = z.object({
  timezone: z.string().optional().default('browser'),
  from: z.string().optional().default('now-6h'),
  to: z.string().optional().default('now'),
  autoRefresh: z.string().optional().default(''),
  autoRefreshIntervals: z.preprocess(
    (value) => (value == null ? ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'] : value),
    z.array(z.string())
  ),
  quickRanges: nullableArray(timeRangeOptionSchema).optional(),
  hideTimepicker: z.boolean().optional().default(false),
  weekStart: z.enum(['saturday', 'monday', 'sunday']).optional(),
  fiscalYearStartMonth: z.number().optional().default(0),
  nowDelay: z.string().optional(),
}) satisfies z.ZodType<TimeSettingsSpec>;

const preferencesSchema = z.object({
  layout: z.union([autoGridLayoutKindSchema, gridLayoutKindSchema]).optional(),
}) satisfies z.ZodType<Preferences>;

const cursorSyncSchema = z.enum(['Crosshair', 'Tooltip', 'Off']);

// ---------------------------------------------------------------------------
// Top-level DashboardV2Spec
// ---------------------------------------------------------------------------

export const dashboardV2SpecSchema = z.object({
  annotations: nullableArray(annotationQueryKindSchema),
  cursorSync: cursorSyncSchema.optional().default('Off'),
  description: z.string().optional(),
  editable: z.boolean().optional().default(true),
  elements: z.preprocess((value) => (value == null ? {} : value), z.record(z.string(), elementSchema)),
  layout: layoutKindSchema,
  links: nullableArray(dashboardLinkSchema),
  liveNow: z.boolean().optional(),
  preload: z.boolean().optional().default(false),
  revision: z.number().optional(),
  tags: nullableArray(z.string()),
  timeSettings: timeSettingsSpecSchema,
  title: z.string(),
  variables: nullableArray(variableKindSchema),
  preferences: preferencesSchema.optional(),
}) satisfies z.ZodType<DashboardV2Spec>;
