/**
 * Canonical Zod schemas for the Dashboard v2 (stable) spec.
 *
 * These mirror the v2 CUE (`apps/dashboard/kinds/v2/dashboard_spec.cue`) and are
 * the single structural source of truth for the v2 DashboardSpec on the
 * frontend. Each schema is verified against its generated TypeScript interface
 * with `satisfies z.ZodMiniType<...>`, so the two cannot drift silently.
 *
 * CUE `*value` defaults are generated as required fields on the TS types, so
 * they are encoded here via `z._default(schema, ...)`: input may omit them,
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

import * as z from 'zod/mini';

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
 * element list (empty when absent/null). Implemented with `z.pipe(z.transform(...), schema)` (not a
 * trailing `.transform`) so the element schema is preserved: elements are still
 * validated, `satisfies z.ZodMiniType<...>` holds, and `z.toJSONSchema` still emits
 * a proper `array` type (a trailing transform would collapse it to `any`).
 */
export function nullableArray<T extends z.ZodMiniType>(element: T) {
  return z.pipe(
    z.transform((value) => (value == null ? [] : value)),
    z.array(element)
  );
}

// ---------------------------------------------------------------------------
// Shared leaves
// ---------------------------------------------------------------------------

const controlSourceRefSchema = z.object({
  type: z.literal('datasource'),
  group: z.string(),
}) satisfies z.ZodMiniType<ControlSourceRef>;

export const elementReferenceSchema = z.object({
  kind: z.literal('ElementReference'),
  name: z.string(),
}) satisfies z.ZodMiniType<ElementReference>;

const datasourceRefSchema = z.object({ name: z.optional(z.string()) });

const dataQueryKindSchema = z.object({
  // Not a discriminated-union member, so defaulting the constant kind keeps the
  // output faithful to the type while tolerating payloads that omit it.
  kind: z._default(z.literal('DataQuery'), 'DataQuery'),
  group: z.string(),
  version: z._default(z.string(), 'v0'),
  labels: z.optional(z.record(z.string(), z.string())),
  datasource: z.optional(datasourceRefSchema),
  spec: z.record(z.string(), z.unknown()),
}) satisfies z.ZodMiniType<DataQueryKind>;

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------

const variableOptionSchema = z.object({
  selected: z.optional(z.boolean()),
  text: z.union([z.string(), z.array(z.string())]),
  value: z.union([z.string(), z.array(z.string())]),
  properties: z.optional(z.record(z.string(), z.string())),
}) satisfies z.ZodMiniType<VariableOption>;

const variableHideSchema = z.enum(['dontHide', 'hideLabel', 'hideVariable', 'inControlsMenu']);
// `.catch(...)` absorbs an unknown/invalid enum value (not just a missing one,
// which `.default(...)` at the usage already handles) by falling back to the
// canonical default. These enums have unambiguous CUE-generated defaults, so a
// bad value from an authoring caller should not fail the whole mutation.
const variableRefreshSchema = z.catch(z.enum(['never', 'onDashboardLoad', 'onTimeRangeChanged']), 'never');
const variableSortSchema = z.catch(
  z.enum([
    'disabled',
    'alphabeticalAsc',
    'alphabeticalDesc',
    'numericalAsc',
    'numericalDesc',
    'alphabeticalCaseInsensitiveAsc',
    'alphabeticalCaseInsensitiveDesc',
    'naturalAsc',
    'naturalDesc',
  ]),
  'disabled'
);
const variableRegexApplyToSchema = z.enum(['value', 'text']);

const defaultVariableOptionValue = { text: '', value: '' };

const metricFindValueSchema = z.object({
  text: z.string(),
  value: z.optional(z.union([z.string(), z.number()])),
  group: z.optional(z.string()),
  expandable: z.optional(z.boolean()),
}) satisfies z.ZodMiniType<MetricFindValue>;

const adHocFilterWithLabelsSchema = z.object({
  key: z.string(),
  operator: z.string(),
  value: z.string(),
  values: z.optional(nullableArray(z.string())),
  keyLabel: z.optional(z.string()),
  valueLabels: z.optional(nullableArray(z.string())),
  forceEdit: z.optional(z.boolean()),
  origin: z.optional(z.literal('dashboard')),
  condition: z.optional(z.string()),
}) satisfies z.ZodMiniType<AdHocFilterWithLabels>;

const queryVariableKindSchema = z.object({
  kind: z.literal('QueryVariable'),
  spec: z.object({
    name: z._default(z.string(), ''),
    current: z._default(variableOptionSchema, defaultVariableOptionValue),
    label: z.optional(z.string()),
    hide: z._default(variableHideSchema, 'dontHide'),
    refresh: z._default(variableRefreshSchema, 'never'),
    skipUrlSync: z._default(z.boolean(), false),
    description: z.optional(z.string()),
    query: dataQueryKindSchema,
    regex: z._default(z.string(), ''),
    regexApplyTo: z.optional(variableRegexApplyToSchema),
    sort: z._default(variableSortSchema, 'disabled'),
    definition: z.optional(z.string()),
    options: nullableArray(variableOptionSchema),
    multi: z._default(z.boolean(), false),
    includeAll: z._default(z.boolean(), false),
    allValue: z.optional(z.string()),
    placeholder: z.optional(z.string()),
    allowCustomValue: z._default(z.boolean(), true),
    staticOptions: z.optional(nullableArray(variableOptionSchema)),
    staticOptionsOrder: z.optional(z.enum(['before', 'after', 'sorted'])),
    origin: z.optional(controlSourceRefSchema),
  }),
});

const textVariableKindSchema = z.object({
  kind: z.literal('TextVariable'),
  spec: z.object({
    name: z._default(z.string(), ''),
    current: z._default(variableOptionSchema, defaultVariableOptionValue),
    query: z._default(z.string(), ''),
    label: z.optional(z.string()),
    hide: z._default(variableHideSchema, 'dontHide'),
    skipUrlSync: z._default(z.boolean(), false),
    description: z.optional(z.string()),
    origin: z.optional(controlSourceRefSchema),
  }),
});

const constantVariableKindSchema = z.object({
  kind: z.literal('ConstantVariable'),
  spec: z.object({
    name: z._default(z.string(), ''),
    query: z._default(z.string(), ''),
    current: z._default(variableOptionSchema, defaultVariableOptionValue),
    label: z.optional(z.string()),
    hide: z._default(variableHideSchema, 'dontHide'),
    skipUrlSync: z._default(z.boolean(), false),
    description: z.optional(z.string()),
    origin: z.optional(controlSourceRefSchema),
  }),
});

const datasourceVariableKindSchema = z.object({
  kind: z.literal('DatasourceVariable'),
  spec: z.object({
    name: z._default(z.string(), ''),
    pluginId: z._default(z.string(), ''),
    refresh: z._default(variableRefreshSchema, 'never'),
    regex: z._default(z.string(), ''),
    current: z._default(variableOptionSchema, defaultVariableOptionValue),
    options: nullableArray(variableOptionSchema),
    multi: z._default(z.boolean(), false),
    includeAll: z._default(z.boolean(), false),
    allValue: z.optional(z.string()),
    label: z.optional(z.string()),
    hide: z._default(variableHideSchema, 'dontHide'),
    skipUrlSync: z._default(z.boolean(), false),
    description: z.optional(z.string()),
    allowCustomValue: z._default(z.boolean(), true),
    origin: z.optional(controlSourceRefSchema),
  }),
});

const intervalVariableKindSchema = z.object({
  kind: z.literal('IntervalVariable'),
  spec: z.object({
    name: z._default(z.string(), ''),
    query: z._default(z.string(), ''),
    current: z._default(variableOptionSchema, defaultVariableOptionValue),
    options: nullableArray(variableOptionSchema),
    auto: z._default(z.boolean(), false),
    auto_min: z._default(z.string(), ''),
    auto_count: z._default(z.number(), 0),
    refresh: z._default(z.literal('onTimeRangeChanged'), 'onTimeRangeChanged'),
    label: z.optional(z.string()),
    hide: z._default(variableHideSchema, 'dontHide'),
    skipUrlSync: z._default(z.boolean(), false),
    description: z.optional(z.string()),
    origin: z.optional(controlSourceRefSchema),
  }),
});

const customVariableKindSchema = z.object({
  kind: z.literal('CustomVariable'),
  spec: z.object({
    name: z._default(z.string(), ''),
    query: z._default(z.string(), ''),
    current: z._default(variableOptionSchema, defaultVariableOptionValue),
    options: nullableArray(variableOptionSchema),
    multi: z._default(z.boolean(), false),
    includeAll: z._default(z.boolean(), false),
    allValue: z.optional(z.string()),
    label: z.optional(z.string()),
    hide: z._default(variableHideSchema, 'dontHide'),
    skipUrlSync: z._default(z.boolean(), false),
    description: z.optional(z.string()),
    allowCustomValue: z._default(z.boolean(), true),
    valuesFormat: z.optional(z.enum(['csv', 'json'])),
    origin: z.optional(controlSourceRefSchema),
  }),
});

const groupByVariableKindSchema = z.object({
  kind: z.literal('GroupByVariable'),
  group: z.string(),
  labels: z.optional(z.record(z.string(), z.string())),
  datasource: z.optional(datasourceRefSchema),
  spec: z.object({
    name: z._default(z.string(), ''),
    defaultValue: z.optional(variableOptionSchema),
    current: z._default(variableOptionSchema, defaultVariableOptionValue),
    options: nullableArray(variableOptionSchema),
    multi: z._default(z.boolean(), false),
    label: z.optional(z.string()),
    hide: z._default(variableHideSchema, 'dontHide'),
    skipUrlSync: z._default(z.boolean(), false),
    description: z.optional(z.string()),
    origin: z.optional(controlSourceRefSchema),
  }),
});

const adhocVariableKindSchema = z.object({
  kind: z.literal('AdhocVariable'),
  group: z.string(),
  labels: z.optional(z.record(z.string(), z.string())),
  datasource: z.optional(datasourceRefSchema),
  spec: z.object({
    name: z._default(z.string(), ''),
    baseFilters: nullableArray(adHocFilterWithLabelsSchema),
    filters: nullableArray(adHocFilterWithLabelsSchema),
    defaultKeys: nullableArray(metricFindValueSchema),
    label: z.optional(z.string()),
    hide: z._default(variableHideSchema, 'dontHide'),
    skipUrlSync: z._default(z.boolean(), false),
    description: z.optional(z.string()),
    allowCustomValue: z._default(z.boolean(), true),
    enableGroupBy: z.optional(z.boolean()),
    origin: z.optional(controlSourceRefSchema),
  }),
});

const switchVariableKindSchema = z.object({
  kind: z.literal('SwitchVariable'),
  spec: z.object({
    name: z._default(z.string(), ''),
    current: z._default(z.string(), 'false'),
    enabledValue: z._default(z.string(), 'true'),
    disabledValue: z._default(z.string(), 'false'),
    label: z.optional(z.string()),
    hide: z._default(variableHideSchema, 'dontHide'),
    skipUrlSync: z._default(z.boolean(), false),
    description: z.optional(z.string()),
    origin: z.optional(controlSourceRefSchema),
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
]) satisfies z.ZodMiniType<VariableKind>;

// ---------------------------------------------------------------------------
// Annotations
// ---------------------------------------------------------------------------

const annotationPanelFilterSchema = z.object({
  exclude: z.optional(z.boolean()),
  ids: nullableArray(z.number()),
}) satisfies z.ZodMiniType<AnnotationPanelFilter>;

const annotationEventFieldMappingSchema = z.object({
  source: z.optional(z.string()),
  value: z.optional(z.string()),
  regex: z.optional(z.string()),
}) satisfies z.ZodMiniType<AnnotationEventFieldMapping>;

export const annotationQueryKindSchema = z.object({
  // Not a discriminated-union member; default the constant kind so a payload can
  // omit it (annotations are a plain array, not a discriminated union).
  kind: z._default(z.literal('AnnotationQuery'), 'AnnotationQuery'),
  spec: z.object({
    query: dataQueryKindSchema,
    enable: z._default(z.boolean(), true),
    hide: z._default(z.boolean(), false),
    iconColor: z._default(z.string(), 'red'),
    name: z.string(),
    builtIn: z.optional(z.boolean()),
    filter: z.optional(annotationPanelFilterSchema),
    placement: z.optional(z.literal('inControlsMenu')),
    mappings: z.optional(z.record(z.string(), annotationEventFieldMappingSchema)),
    legacyOptions: z.optional(z.record(z.string(), z.unknown())),
  }),
}) satisfies z.ZodMiniType<AnnotationQueryKind>;

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
}) satisfies z.ZodMiniType<ConditionalRenderingVariableKind>;

const conditionalRenderingDataKindSchema = z.object({
  kind: z.literal('ConditionalRenderingData'),
  spec: z.object({ value: z.boolean() }),
}) satisfies z.ZodMiniType<ConditionalRenderingDataKind>;

const conditionalRenderingTimeRangeSizeKindSchema = z.object({
  kind: z.literal('ConditionalRenderingTimeRangeSize'),
  spec: z.object({ value: z.string() }),
}) satisfies z.ZodMiniType<ConditionalRenderingTimeRangeSizeKind>;

const conditionalRenderingGroupKindSchema = z.object({
  kind: z.literal('ConditionalRenderingGroup'),
  spec: z.object({
    // Tolerate a missing/invalid value by defaulting to the canonical 'show'.
    visibility: z.catch(z.enum(['show', 'hide']), 'show'),
    condition: z.enum(['and', 'or']),
    items: nullableArray(
      z.discriminatedUnion('kind', [
        conditionalRenderingVariableKindSchema,
        conditionalRenderingDataKindSchema,
        conditionalRenderingTimeRangeSizeKindSchema,
      ])
    ),
  }),
}) satisfies z.ZodMiniType<ConditionalRenderingGroupKind>;

// ---------------------------------------------------------------------------
// Panel (query stack + viz config)
// ---------------------------------------------------------------------------

const dataLinkSchema = z.object({
  title: z.string(),
  url: z.string(),
  targetBlank: z.optional(z.boolean()),
});

const panelQueryKindSchema = z.object({
  kind: z.literal('PanelQuery'),
  spec: z.object({
    query: dataQueryKindSchema,
    refId: z._default(z.string(), 'A'),
    hidden: z._default(z.boolean(), false),
  }),
}) satisfies z.ZodMiniType<PanelQueryKind>;

const matcherConfigSchema = z.object({
  id: z._default(z.string(), ''),
  scope: z.optional(z.enum(['series', 'nested', 'annotation', 'exemplar'])),
  options: z.optional(z.unknown()),
});

const transformationKindSchema = z.object({
  kind: z.literal('Transformation'),
  group: z.string(),
  spec: z.object({
    refId: z.optional(z.string()),
    disabled: z.optional(z.boolean()),
    filter: z.optional(matcherConfigSchema),
    topic: z.optional(z.enum(['series', 'annotations', 'alertStates'])),
    options: z.unknown(),
  }),
}) satisfies z.ZodMiniType<TransformationKind>;

const queryOptionsSpecSchema = z.object({
  timeFrom: z.optional(z.string()),
  timeTo: z.optional(z.string()),
  maxDataPoints: z.optional(z.number()),
  timeShift: z.optional(z.string()),
  queryCachingTTL: z.optional(z.number()),
  interval: z.optional(z.string()),
  cacheTimeout: z.optional(z.string()),
  hideTimeOverride: z.optional(z.boolean()),
  timeCompare: z.optional(z.string()),
}) satisfies z.ZodMiniType<QueryOptionsSpec>;

const queryGroupKindSchema = z.object({
  kind: z.literal('QueryGroup'),
  spec: z.object({
    queries: nullableArray(panelQueryKindSchema),
    transformations: nullableArray(transformationKindSchema),
    queryOptions: queryOptionsSpecSchema,
  }),
}) satisfies z.ZodMiniType<QueryGroupKind>;

// FieldConfigSource is kept faithful but permissive: `defaults` is an open bag
// (panel-plugin field config), and override `properties` carry arbitrary values.
const fieldConfigSourceSchema = z.object({
  defaults: z.record(z.string(), z.unknown()),
  overrides: nullableArray(
    z.object({
      __systemRef: z.optional(z.string()),
      matcher: matcherConfigSchema,
      properties: nullableArray(z.object({ id: z.string(), value: z.optional(z.unknown()) })),
    })
  ),
}) satisfies z.ZodMiniType<FieldConfigSource>;

const vizConfigKindSchema = z.object({
  kind: z.literal('VizConfig'),
  group: z.string(),
  // The panel plugin version is runtime metadata (used only for panel
  // migrations) and is stamped from the running plugin when absent, so an
  // authoring caller need not supply it. Optional here; the scene transform
  // treats an empty value as "current version".
  version: z._default(z.string(), ''),
  spec: z.object({
    // `transformSceneToSaveModelSchemaV2` passes `vizPanel.state.options` through
    // verbatim, which is `undefined` for a panel that never set options. Normalize
    // to `{}` so validating serialized output doesn't reject what GET_SPEC returns.
    options: z.pipe(
      z.transform((value) => (value == null ? {} : value)),
      z.record(z.string(), z.unknown())
    ),
    fieldConfig: fieldConfigSourceSchema,
  }),
}) satisfies z.ZodMiniType<VizConfigKind>;

export const panelKindSchema = z.object({
  kind: z.literal('Panel'),
  spec: z.object({
    id: z.number(),
    title: z.string(),
    description: z.optional(z.string()),
    subtitle: z.optional(z.string()),
    links: nullableArray(dataLinkSchema),
    data: queryGroupKindSchema,
    vizConfig: vizConfigKindSchema,
    transparent: z.optional(z.boolean()),
  }),
}) satisfies z.ZodMiniType<PanelKind>;

export const libraryPanelKindSchema = z.object({
  kind: z.literal('LibraryPanel'),
  spec: z.object({
    id: z.number(),
    title: z.string(),
    libraryPanel: z.object({ name: z.string(), uid: z.string() }),
  }),
}) satisfies z.ZodMiniType<LibraryPanelKind>;

const elementSchema = z.discriminatedUnion('kind', [
  panelKindSchema,
  libraryPanelKindSchema,
]) satisfies z.ZodMiniType<DashboardElement>;

// ---------------------------------------------------------------------------
// Layout (recursive)
// ---------------------------------------------------------------------------

type AnyLayoutKind = GridLayoutKind | RowsLayoutKind | AutoGridLayoutKind | TabsLayoutKind;

const repeatOptionsSchema = z.object({
  mode: z.literal('variable'),
  value: z.string(),
  direction: z.optional(z.enum(['h', 'v'])),
  maxPerRow: z.optional(z.number()),
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
    repeat: z.optional(repeatOptionsSchema),
  }),
}) satisfies z.ZodMiniType<GridLayoutItemKind>;

const gridLayoutKindSchema = z.object({
  kind: z.literal('GridLayout'),
  spec: z.object({ items: nullableArray(gridLayoutItemKindSchema) }),
}) satisfies z.ZodMiniType<GridLayoutKind>;

const autoGridLayoutItemKindSchema = z.object({
  kind: z.literal('AutoGridLayoutItem'),
  spec: z.object({
    element: elementReferenceSchema,
    repeat: z.optional(autoGridRepeatOptionsSchema),
    conditionalRendering: z.optional(conditionalRenderingGroupKindSchema),
  }),
}) satisfies z.ZodMiniType<AutoGridLayoutItemKind>;

const autoGridLayoutKindSchema = z.object({
  kind: z.literal('AutoGridLayout'),
  spec: z.object({
    maxColumnCount: z.optional(z.number()),
    columnWidthMode: z._default(z.enum(['narrow', 'standard', 'wide', 'custom']), 'standard'),
    columnWidth: z.optional(z.number()),
    rowHeightMode: z._default(z.enum(['short', 'standard', 'tall', 'custom']), 'standard'),
    rowHeight: z.optional(z.number()),
    fillScreen: z.optional(z.boolean()),
    items: nullableArray(autoGridLayoutItemKindSchema),
  }),
}) satisfies z.ZodMiniType<AutoGridLayoutKind>;

const rowsLayoutRowKindSchema = z.object({
  kind: z.literal('RowsLayoutRow'),
  spec: z.object({
    title: z.optional(z.string()),
    collapse: z.optional(z.boolean()),
    hideHeader: z.optional(z.boolean()),
    fillScreen: z.optional(z.boolean()),
    conditionalRendering: z.optional(conditionalRenderingGroupKindSchema),
    repeat: z.optional(rowRepeatOptionsSchema),
    layout: z.lazy((): z.ZodMiniType<AnyLayoutKind> => layoutKindSchema),
    variables: z.optional(nullableArray(variableKindSchema)),
  }),
}) satisfies z.ZodMiniType<RowsLayoutRowKind>;

const rowsLayoutKindSchema = z.object({
  kind: z.literal('RowsLayout'),
  spec: z.object({ rows: nullableArray(rowsLayoutRowKindSchema) }),
}) satisfies z.ZodMiniType<RowsLayoutKind>;

const tabsLayoutTabKindSchema = z.object({
  kind: z.literal('TabsLayoutTab'),
  spec: z.object({
    title: z.optional(z.string()),
    layout: z.lazy((): z.ZodMiniType<AnyLayoutKind> => layoutKindSchema),
    conditionalRendering: z.optional(conditionalRenderingGroupKindSchema),
    repeat: z.optional(tabRepeatOptionsSchema),
    variables: z.optional(nullableArray(variableKindSchema)),
  }),
}) satisfies z.ZodMiniType<TabsLayoutTabKind>;

const tabsLayoutKindSchema = z.object({
  kind: z.literal('TabsLayout'),
  spec: z.object({ tabs: nullableArray(tabsLayoutTabKindSchema) }),
}) satisfies z.ZodMiniType<TabsLayoutKind>;

const layoutKindSchema: z.ZodMiniType<AnyLayoutKind> = z.discriminatedUnion('kind', [
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
  type: z._default(z.enum(['link', 'dashboards']), 'link'),
  icon: z._default(z.string(), ''),
  tooltip: z._default(z.string(), ''),
  url: z.optional(z.string()),
  tags: nullableArray(z.string()),
  asDropdown: z._default(z.boolean(), false),
  targetBlank: z._default(z.boolean(), false),
  includeVars: z._default(z.boolean(), false),
  keepTime: z._default(z.boolean(), false),
  placement: z.optional(z.literal('inControlsMenu')),
  origin: z.optional(controlSourceRefSchema),
}) satisfies z.ZodMiniType<DashboardLink>;

const timeRangeOptionSchema = z.object({
  display: z._default(z.string(), 'Last 6 hours'),
  from: z._default(z.string(), 'now-6h'),
  to: z._default(z.string(), 'now'),
}) satisfies z.ZodMiniType<TimeRangeOption>;

export const timeSettingsSpecSchema = z.object({
  timezone: z._default(z.string(), 'browser'),
  from: z._default(z.string(), 'now-6h'),
  to: z._default(z.string(), 'now'),
  autoRefresh: z._default(z.string(), ''),
  autoRefreshIntervals: z.pipe(
    z.transform((value) => (value == null ? ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'] : value)),
    z.array(z.string())
  ),
  quickRanges: z.optional(nullableArray(timeRangeOptionSchema)),
  hideTimepicker: z._default(z.boolean(), false),
  weekStart: z.optional(z.enum(['saturday', 'monday', 'sunday'])),
  fiscalYearStartMonth: z._default(z.number(), 0),
  nowDelay: z.optional(z.string()),
}) satisfies z.ZodMiniType<TimeSettingsSpec>;

const preferencesSchema = z.object({
  layout: z.optional(z.union([autoGridLayoutKindSchema, gridLayoutKindSchema])),
}) satisfies z.ZodMiniType<Preferences>;

const cursorSyncSchema = z.enum(['Crosshair', 'Tooltip', 'Off']);

// ---------------------------------------------------------------------------
// Top-level DashboardV2Spec
// ---------------------------------------------------------------------------

export const dashboardV2SpecSchema = z.object({
  annotations: nullableArray(annotationQueryKindSchema),
  cursorSync: z._default(cursorSyncSchema, 'Off'),
  description: z.optional(z.string()),
  editable: z._default(z.boolean(), true),
  elements: z.pipe(
    z.transform((value) => (value == null ? {} : value)),
    z.record(z.string(), elementSchema)
  ),
  layout: layoutKindSchema,
  links: nullableArray(dashboardLinkSchema),
  liveNow: z.optional(z.boolean()),
  preload: z._default(z.boolean(), false),
  revision: z.optional(z.number()),
  tags: nullableArray(z.string()),
  timeSettings: timeSettingsSpecSchema,
  title: z.string(),
  variables: nullableArray(variableKindSchema),
  preferences: z.optional(preferencesSchema),
}) satisfies z.ZodMiniType<DashboardV2Spec>;
