/**
 * Dashboard Mutation API -- Canonical Zod Schemas & Payload Definitions
 *
 * This file contains two layers:
 *
 * 1. BUILDING-BLOCK SCHEMAS -- v2beta1 data structures (VariableKind, etc.)
 *    used internally by core code. Most are now re-exports of the CUE-derived
 *    bundle at `apps/dashboard/zod-schemas/v2beta1`, with mutation-API-specific
 *    overrides applied via `.extend()` / `.omit()`. See MIGRATION_NOTES.md
 *    (temporary, intended for the PR description) for per-schema migration
 *    notes labelled `MIGRATION T1/T2/T4`.
 *
 * 2. PAYLOAD SCHEMAS & `payloads` RECORD -- one Zod schema per mutation
 *    command, accessible via DashboardMutationAPI.getPayloadSchema().
 *    These are mutation-API contracts and stay manual.
 *
 * This file only depends on Zod and the generated bundle, keeping it safe
 * for import from any internal module without pulling in the DashboardScene
 * dependency tree.
 *
 * DEFAULTS: Literal `kind` and `version` fields use .optional().default()
 * so consumers (e.g. LLM tools) can omit boilerplate. After parsing, these
 * fields are always present in the output.
 *
 * The `.describe()` annotations flow into generated JSON Schema via
 * `z.toJSONSchema()` and are used by LLM tool consumers for guidance.
 */

import { z } from 'zod';

import type { GridLayoutItemKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import {
  autoGridLayoutItemKindSchema as autoGridLayoutItemKindSchemaBundle,
  conditionalRenderingGroupKindSchema,
  dataLinkSchema,
  dataQueryKindSchema as dataQueryKindSchemaBase,
  elementReferenceSchema,
  gridLayoutItemKindSchema as gridLayoutItemKindSchemaBase,
  gridLayoutItemSpecSchema,
  panelKindSchema as panelKindSchemaBase,
  panelQueryKindSchema as panelQueryKindSchemaBase,
  panelSpecSchema,
  queryGroupKindSchema as queryGroupKindSchemaBase,
  queryGroupSpecSchema,
  queryOptionsSpecSchema as queryOptionsSpecSchemaBundle,
  rowRepeatOptionsSchema,
  rowsLayoutRowSpecSchema as rowsLayoutRowSpecSchemaBase,
  tabRepeatOptionsSchema,
  tabsLayoutTabSpecSchema as tabsLayoutTabSpecSchemaBase,
  variableHideSchema,
  variableOptionSchema,
  variableRefreshSchema,
  variableSortSchema as variableSortSchemaBase,
  vizConfigKindSchema as vizConfigKindSchemaBase,
} from '../../../../../../apps/dashboard/zod-schemas/v2beta1';

const variableSortSchema = variableSortSchemaBase.default('disabled');

// MIGRATION T2: re-export from bundle, swap `spec: z.object({})` for the
// LLM-friendly `z.record(z.string(), z.unknown())`. Bundle additionally exposes
// `labels`; we accept it (silently ignored downstream) — see MIGRATION_NOTES.md.
export const dataQueryKindSchema = dataQueryKindSchemaBase.extend({
  spec: z.record(z.string(), z.unknown()).describe('Query-specific fields (e.g., expr for Prometheus, rawSql for SQL)'),
});

const adHocFilterSchema = z.object({
  key: z.string().describe('Filter key (dimension name)'),
  operator: z.string().describe('Comparison operator (e.g., "=", "!=", "=~")'),
  value: z.string().describe('Filter value'),
  values: z.array(z.string()).optional().describe('Multiple filter values'),
  keyLabel: z.string().optional().describe('Display label for the key'),
  valueLabels: z.array(z.string()).optional().describe('Display labels for values'),
  forceEdit: z.boolean().optional(),
  origin: z.literal('dashboard').optional(),
});

const metricFindValueSchema = z.object({
  text: z.string().describe('Display text'),
  value: z.union([z.string(), z.number()]).optional().describe('Option value'),
  group: z.string().optional(),
  expandable: z.boolean().optional(),
});

const defaultVariableOption = { text: '', value: '' };

// Common spec fields shared by all variable types
const commonVariableSpecFields = {
  name: z.string().describe('The name of the variable. Must be unique within the dashboard.'),
  label: z.string().optional().describe('The label of the variable displayed in the UI dropdown'),
  description: z.string().optional().describe('The description of the variable, shown as tooltip'),
  hide: variableHideSchema,
  skipUrlSync: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether the variable value should be managed by URL query params or not'),
};

// Per-type variable kind schemas (v2beta1)

export const queryVariableKindSchema = z
  .object({
    kind: z.literal('QueryVariable'),
    spec: z.object({
      ...commonVariableSpecFields,
      query: dataQueryKindSchema.describe(
        'The data query to use for fetching variable options. Uses v2beta1 DataQueryKind format. For Prometheus string queries use { "__grafana_string_value": "label_values(metric, label)" } in spec.'
      ),
      refresh: variableRefreshSchema,
      regex: z
        .string()
        .optional()
        .default('')
        .describe(
          'Regex used to extract part of a series name or metric node segment. Named capture groups can be used to separate the display text and value.'
        ),
      regexApplyTo: z
        .enum(['value', 'text'])
        .optional()
        .describe('Whether regex applies to variable "value" (used in queries) or "text" (shown to users)'),
      sort: variableSortSchema,
      multi: z.boolean().optional().default(false).describe('Flag indicating if the variable can have multiple values'),
      includeAll: z
        .boolean()
        .optional()
        .default(false)
        .describe("Flag indicating if the variable should include the 'All' option"),
      allValue: z.string().optional().describe("Custom value to use when 'All' is selected"),
      allowCustomValue: z
        .boolean()
        .optional()
        .default(true)
        .describe('Flag indicating if the variable can have a custom value'),
      current: variableOptionSchema
        .optional()
        .default(defaultVariableOption)
        .describe('The current value of the variable'),
      options: z
        .array(variableOptionSchema)
        .optional()
        .default([])
        .describe('The available options for the variable (populated automatically from the query)'),
      placeholder: z.string().optional().describe('Placeholder text when no value is selected'),
      definition: z.string().optional().describe('Query definition string for display'),
      staticOptions: z
        .array(variableOptionSchema)
        .optional()
        .describe('Static options to include alongside query results'),
      staticOptionsOrder: z
        .enum(['before', 'after', 'sorted'])
        .optional()
        .describe('Where to place static options relative to query results'),
    }),
  })
  .describe(
    'QueryVariable: Query-generated list of values such as metric names, server names, sensor IDs, data centers, and so on.'
  );

export const customVariableKindSchema = z
  .object({
    kind: z.literal('CustomVariable'),
    spec: z.object({
      ...commonVariableSpecFields,
      query: z
        .string()
        .describe(
          'Comma-separated list of options defining the variable values (e.g., "dev,staging,prod"). Avoid for single options.'
        ),
      multi: z.boolean().optional().default(false).describe('Flag indicating if the variable can have multiple values'),
      includeAll: z
        .boolean()
        .optional()
        .default(false)
        .describe("Flag indicating if the variable should include the 'All' option"),
      allValue: z.string().optional().describe("Custom value to use when 'All' is selected"),
      allowCustomValue: z
        .boolean()
        .optional()
        .default(true)
        .describe('Flag indicating if the variable can have a custom value'),
      current: variableOptionSchema
        .optional()
        .default(defaultVariableOption)
        .describe('The current value of the variable'),
      options: z.array(variableOptionSchema).optional().default([]).describe('The available options for the variable'),
      valuesFormat: z.enum(['csv', 'json']).optional().describe('Format for multi-value output'),
    }),
  })
  .describe('CustomVariable: Define the variable options manually using a comma-separated list.');

export const datasourceVariableKindSchema = z
  .object({
    kind: z.literal('DatasourceVariable'),
    spec: z.object({
      ...commonVariableSpecFields,
      pluginId: z
        .string()
        .describe(
          'The datasource plugin type to list instances of (e.g., "prometheus", "loki", "mysql"). Allows switching between different instances of the same datasource type.'
        ),
      refresh: variableRefreshSchema,
      regex: z
        .string()
        .optional()
        .default('')
        .describe('Regex to filter the datasource instances shown in the dropdown'),
      multi: z.boolean().optional().default(false).describe('Flag indicating if the variable can have multiple values'),
      includeAll: z
        .boolean()
        .optional()
        .default(false)
        .describe("Flag indicating if the variable should include the 'All' option"),
      allValue: z.string().optional().describe("Custom value to use when 'All' is selected"),
      allowCustomValue: z
        .boolean()
        .optional()
        .default(true)
        .describe('Flag indicating if the variable can have a custom value'),
      current: variableOptionSchema
        .optional()
        .default(defaultVariableOption)
        .describe('The currently selected datasource'),
      options: z
        .array(variableOptionSchema)
        .optional()
        .default([])
        .describe('The available datasource options (populated automatically)'),
    }),
  })
  .describe('DatasourceVariable: Quickly change the data source for an entire dashboard.');

export const intervalVariableKindSchema = z
  .object({
    kind: z.literal('IntervalVariable'),
    spec: z.object({
      ...commonVariableSpecFields,
      query: z
        .string()
        .describe(
          'Comma-separated time intervals representing the available options (e.g., "1m,5m,15m,1h,6h,12h,1d,7d")'
        ),
      auto: z
        .boolean()
        .optional()
        .default(false)
        .describe('Enable automatic interval calculation based on the current time range and panel width'),
      auto_min: z
        .string()
        .optional()
        .default('')
        .describe('Minimum auto interval (e.g., "10s", "1m"). Prevents intervals from becoming too small.'),
      auto_count: z
        .number()
        .optional()
        .default(0)
        .describe('Target number of data points for auto interval calculation'),
      refresh: z.literal('onTimeRangeChanged').optional().default('onTimeRangeChanged'),
      current: variableOptionSchema
        .optional()
        .default(defaultVariableOption)
        .describe('The currently selected interval'),
      options: z
        .array(variableOptionSchema)
        .optional()
        .default([])
        .describe('The available interval options (populated from query)'),
    }),
  })
  .describe('IntervalVariable: Represents time spans (e.g., "1m", "1h") for controlling time aggregations in queries.');

export const constantVariableKindSchema = z
  .object({
    kind: z.literal('ConstantVariable'),
    spec: z.object({
      ...commonVariableSpecFields,
      query: z
        .string()
        .describe(
          'The constant value. Useful for internal dashboard logic or complex query parts you do not want users to change.'
        ),
      current: variableOptionSchema
        .optional()
        .default(defaultVariableOption)
        .describe('The current value of the variable'),
    }),
  })
  .describe(
    "ConstantVariable: A hidden, fixed value. Useful for internal dashboard logic or complex query parts you don't want users to change."
  );

export const textVariableKindSchema = z
  .object({
    kind: z.literal('TextVariable'),
    spec: z.object({
      ...commonVariableSpecFields,
      query: z.string().optional().default('').describe('Default value for the free-form text input field'),
      current: variableOptionSchema
        .optional()
        .default(defaultVariableOption)
        .describe('The current value of the variable'),
    }),
  })
  .describe('TextVariable: A free-form text input field for user-provided filters or parameters.');

export const groupByVariableKindSchema = z
  .object({
    kind: z.literal('GroupByVariable'),
    group: z.string().describe('Datasource type (e.g., "prometheus", "loki")'),
    datasource: z.object({ name: z.string().optional() }).optional().describe('Datasource reference'),
    spec: z.object({
      ...commonVariableSpecFields,
      defaultValue: variableOptionSchema.optional().describe('Default selected value'),
      current: variableOptionSchema
        .optional()
        .default(defaultVariableOption)
        .describe('The current value of the variable'),
      options: z.array(variableOptionSchema).optional().default([]).describe('The available options for the variable'),
      multi: z.boolean().optional().default(false).describe('Flag indicating if the variable can have multiple values'),
    }),
  })
  .describe(
    'GroupByVariable: Group-by dimension selector. Allows grouping query results by a dimension. Has top-level group and datasource fields for data source binding.'
  );

export const adhocVariableKindSchema = z
  .object({
    kind: z.literal('AdhocVariable'),
    group: z.string().describe('Datasource type (e.g., "prometheus", "loki")'),
    datasource: z.object({ name: z.string().optional() }).optional().describe('Datasource reference'),
    spec: z.object({
      ...commonVariableSpecFields,
      baseFilters: z.array(adHocFilterSchema).optional().default([]).describe('Base filters always applied to queries'),
      filters: z.array(adHocFilterSchema).optional().default([]).describe('User-configured filters applied to queries'),
      defaultKeys: z
        .array(metricFindValueSchema)
        .optional()
        .default([])
        .describe('Default dimension keys shown in the filter dropdown'),
      allowCustomValue: z
        .boolean()
        .optional()
        .default(true)
        .describe('Flag indicating if custom filter values can be entered'),
    }),
  })
  .describe(
    'AdhocVariable: Filter builder that adds key/value filters to all queries for a data source. Has top-level group and datasource fields for data source binding.'
  );

export const switchVariableKindSchema = z
  .object({
    kind: z.literal('SwitchVariable'),
    spec: z.object({
      ...commonVariableSpecFields,
      current: z.string().optional().default('false').describe('Current toggle state ("true" or "false")'),
      enabledValue: z
        .string()
        .optional()
        .default('true')
        .describe('Value substituted in queries when the toggle is enabled'),
      disabledValue: z
        .string()
        .optional()
        .default('false')
        .describe('Value substituted in queries when the toggle is disabled'),
    }),
  })
  .describe(
    'SwitchVariable: A boolean toggle variable. Uses current as a string ("true"/"false"), not VariableOption.'
  );

export const variableKindSchema = z.discriminatedUnion('kind', [
  queryVariableKindSchema,
  customVariableKindSchema,
  datasourceVariableKindSchema,
  intervalVariableKindSchema,
  constantVariableKindSchema,
  textVariableKindSchema,
  groupByVariableKindSchema,
  adhocVariableKindSchema,
  switchVariableKindSchema,
]);

export const emptyPayloadSchema = z.object({}).strict();

// Mutation-API-only layout helpers (no equivalent in CUE).

export const layoutPathSchema = z
  .string()
  .regex(/^\/([a-z]+\/\d+(\/[a-z]+\/\d+)*)?$/)
  .describe(
    'Path to a location in the layout tree, from GET_LAYOUT output. ' +
      'Examples: "/" (root), "/rows/0" (first row), "/tabs/1/rows/0" (first row inside second tab).'
  );

export const gridPositionSchema = z
  .object({
    x: z.number().optional().describe('Column position (0-23 in a 24-column grid)'),
    y: z.number().optional().describe('Row position'),
    width: z.number().optional().describe('Width in grid columns (1-24)'),
    height: z.number().optional().describe('Height in grid units'),
  })
  .describe('Grid position (partial GridLayoutItemSpec). Keeps current values for omitted fields.');

// CUE-derived layout building blocks (re-exports / extensions of the bundle).
// `rowRepeatOptionsSchema`, `tabRepeatOptionsSchema`, `repeatOptionsSchema` and
// `conditionalRendering*` kinds are imported above and used as-is.

// MIGRATION T2: re-export bundle schema with two adjustments:
// 1. .omit({ layout, variables }) — `layout` is required in CUE because rows always
//    contain a layout, but the mutation API ADD_ROW creates rows without specifying
//    layout (it's chosen by the parent container). `variables` is row-scoped and
//    not part of the mutation surface.
// 2. .extend with .default(false) on collapse/hideHeader/fillScreen so LLM tools
//    can omit boilerplate booleans.
export const rowsLayoutRowSpecSchema = rowsLayoutRowSpecSchemaBase.omit({ layout: true, variables: true }).extend({
  collapse: z.boolean().optional().default(false),
  hideHeader: z.boolean().optional().default(false),
  fillScreen: z.boolean().optional().default(false),
});

export const partialRowSpecSchema = z
  .object({
    title: z.string().optional().describe('Row heading title'),
    collapse: z.boolean().optional().describe('Whether the row is collapsed'),
    hideHeader: z.boolean().optional().describe('Hide the row header'),
    fillScreen: z.boolean().optional().describe('Row fills viewport height'),
    repeat: rowRepeatOptionsSchema
      .optional()
      .describe('Repeat row for each value of a variable. Omit to leave unchanged.'),
    conditionalRendering: conditionalRenderingGroupKindSchema
      .optional()
      .describe('Show/hide rules for this row. Omit to leave unchanged.'),
  })
  .describe('Fields to update (partial RowsLayoutRowSpec)');

// MIGRATION T2: re-export bundle schema, .omit({ layout, variables }) for the
// same reason as rowsLayoutRowSpecSchema above.
export const tabsLayoutTabSpecSchema = tabsLayoutTabSpecSchemaBase.omit({ layout: true, variables: true });

export const partialTabSpecSchema = z
  .object({
    title: z.string().optional().describe('Tab title'),
    repeat: tabRepeatOptionsSchema
      .optional()
      .describe('Repeat tab for each value of a variable. Omit to leave unchanged.'),
    conditionalRendering: conditionalRenderingGroupKindSchema
      .optional()
      .describe('Show/hide rules for this tab. Omit to leave unchanged.'),
  })
  .describe('Fields to update (partial TabsLayoutTabSpec)');

// Payload schemas -- one per mutation command.
// These compose the building-block schemas above into the exact shape
// each command's `payload` field expects.

export const addVariablePayloadSchema = z.object({
  variable: variableKindSchema.describe('Variable definition (VariableKind)'),
  position: z.number().optional().describe('Position in variables list (optional, appends if not set)'),
});

export const updateVariablePayloadSchema = z.object({
  name: z.string().describe('Variable name to update'),
  variable: variableKindSchema.describe('New variable definition (VariableKind)'),
});

export const removeVariablePayloadSchema = z.object({
  name: z.string().describe('Variable name to remove'),
});

// Layout payload schemas

export const getLayoutPayloadSchema = emptyPayloadSchema;

export const addRowPayloadSchema = z.object({
  row: z.object({
    kind: z.literal('RowsLayoutRow').optional().default('RowsLayoutRow'),
    spec: rowsLayoutRowSpecSchema,
  }),
  parentPath: layoutPathSchema
    .optional()
    .default('/')
    .describe('Path to the parent container. "/" for root, or e.g. "/tabs/0" to add inside a tab.'),
  position: z.number().optional().describe('Zero-based index within the parent to insert at (appends if omitted)'),
});

export const removeRowPayloadSchema = z.object({
  path: layoutPathSchema.describe('Path to the row (e.g., "/rows/1", "/tabs/0/rows/2")'),
  moveContentTo: layoutPathSchema
    .optional()
    .describe('Path to another group to move contained content to. Content is deleted if omitted.'),
});

export const updateRowPayloadSchema = z.object({
  path: layoutPathSchema.describe('Path to the row'),
  spec: partialRowSpecSchema,
});

export const moveRowPayloadSchema = z.object({
  path: layoutPathSchema.describe('Current path to the row (e.g., "/rows/2", "/tabs/0/rows/1")'),
  toParent: layoutPathSchema
    .optional()
    .describe('Path to the destination parent. Omit to reorder within the same parent.'),
  toPosition: z.number().optional().describe('Zero-based index at the destination (appends if omitted)'),
});

export const addTabPayloadSchema = z.object({
  tab: z.object({
    kind: z.literal('TabsLayoutTab').optional().default('TabsLayoutTab'),
    spec: tabsLayoutTabSpecSchema,
  }),
  parentPath: layoutPathSchema
    .optional()
    .default('/')
    .describe('Path to the parent container. "/" for root, or e.g. "/rows/0" to add inside a row.'),
  position: z.number().optional().describe('Zero-based index within the parent to insert at (appends if omitted)'),
});

export const removeTabPayloadSchema = z.object({
  path: layoutPathSchema.describe('Path to the tab (e.g., "/tabs/1", "/rows/0/tabs/2")'),
  moveContentTo: layoutPathSchema
    .optional()
    .describe('Path to another group to move contained content to. Content is deleted if omitted.'),
});

export const updateTabPayloadSchema = z.object({
  path: layoutPathSchema.describe('Path to the tab'),
  spec: partialTabSpecSchema,
});

export const moveTabPayloadSchema = z.object({
  path: layoutPathSchema.describe('Current path to the tab (e.g., "/tabs/2", "/rows/0/tabs/1")'),
  toParent: layoutPathSchema
    .optional()
    .describe('Path to the destination parent. Omit to reorder within the same parent.'),
  toPosition: z.number().optional().describe('Zero-based index at the destination (appends if omitted)'),
});

export const layoutTypeSchema = z.enum(['RowsLayout', 'TabsLayout', 'GridLayout', 'AutoGridLayout']);

export const autoGridOptionsSchema = z
  .object({
    maxColumnCount: z.number().optional().describe('Maximum number of columns'),
    columnWidthMode: z
      .enum(['narrow', 'standard', 'wide', 'custom'])
      .optional()
      .describe('Column width preset. Use "custom" with columnWidth for pixel values.'),
    columnWidth: z
      .number()
      .optional()
      .describe('Custom column width in pixels (only used when columnWidthMode is "custom")'),
    rowHeightMode: z
      .enum(['short', 'standard', 'tall', 'custom'])
      .optional()
      .describe('Row height preset. Use "custom" with rowHeight for pixel values.'),
    rowHeight: z.number().optional().describe('Custom row height in pixels (only used when rowHeightMode is "custom")'),
    fillScreen: z.boolean().optional().describe('Whether the grid fills the viewport height'),
  })
  .describe('Options for AutoGridLayout only. Rejected for other layout types.');

// Panel building-block schemas (v2beta1)

// MIGRATION T2: re-export bundle schema, override `spec` to:
// 1. point at our locally-extended `dataQueryKindSchema` (LLM-friendly record spec)
// 2. drop bundle's `refId.default('A')` — mutation API requires an explicit refId
// 3. make `hidden` optional+default(false) for LLM ergonomics
export const panelQueryKindSchema = panelQueryKindSchemaBase.extend({
  spec: z.object({
    query: dataQueryKindSchema,
    refId: z.string(),
    hidden: z.boolean().optional().default(false),
  }),
});

export type PanelQueryKind = z.infer<typeof panelQueryKindSchema>;

// MIGRATION T4: kept manual. The mutation API uses a different transformation
// protocol than CUE: `kind` is the constant 'Transformation' and the transformer
// ID lives on a separate `group` field. CUE puts the transformer ID directly in
// `kind` (`kind: z.string()`). These two protocols cannot be reconciled without
// a breaking API change. See MIGRATION_NOTES.md for follow-up.
export const transformationKindSchema = z
  .object({
    kind: z.literal('Transformation').describe('Fixed literal "Transformation"'),
    group: z.string().describe('Transformation ID (e.g., "organize", "sortBy", "filterByValue")'),
    spec: z.object({
      disabled: z.boolean().optional().describe('Disabled transformations are skipped'),
      filter: z
        .object({
          id: z.string().describe('Matcher ID'),
          options: z.unknown().optional().describe('Matcher options'),
        })
        .optional()
        .describe('Optional frame matcher to scope the transformation'),
      topic: z
        .enum(['series', 'annotations', 'alertStates'])
        .optional()
        .describe('Data topic to pull frames from as input'),
      options: z.record(z.string(), z.unknown()).optional().default({}).describe('Transformation-specific options'),
    }),
  })
  .describe('A data transformation applied to query results');

export type TransformationKind = z.infer<typeof transformationKindSchema>;

// MIGRATION T1: re-export from bundle. Behavior change: `maxDataPoints` and
// `queryCachingTTL` are now `z.int()` instead of `z.number()` — fractional inputs
// will be rejected (semantically correct for both fields).
export const queryOptionsSpecSchema = queryOptionsSpecSchemaBundle;

// MIGRATION T4: kept manual. Bundle's name `fieldConfigSchema` refers to a
// per-field configuration (displayName, color, etc.); the equivalent
// "defaults + overrides" container is `fieldConfigSourceSchema` and is fully
// typed with the per-field schema. The mutation API needs a permissive container
// (record-typed defaults, free-form override properties) so LLM tools can submit
// arbitrary plugin-specific shapes without rejection.
export const fieldConfigSchema = z
  .object({
    defaults: z
      .record(z.string(), z.unknown())
      .optional()
      .default({})
      .describe('Default field config applied to all fields'),
    overrides: z
      .array(
        z.object({
          matcher: z.object({
            id: z.string().describe('Matcher ID'),
            options: z.unknown().optional().describe('Matcher options'),
          }),
          properties: z.array(
            z.object({
              id: z.string().describe('Property ID'),
              value: z.unknown().optional().describe('Property value'),
            })
          ),
        })
      )
      .optional()
      .default([])
      .describe('Field config overrides for specific fields'),
  })
  .describe('Field configuration (defaults and overrides)');

// MIGRATION T2: re-export bundle schema with overrides:
// - version: optional+default('')
// - spec: rewrite as the mutation-API-shaped permissive object (record options +
//   loose fieldConfig with defaults). Lost: bundle's strict `vizConfigSpecSchema`.
// Behavior change: `group` no longer has `.min(1)` validation — empty plugin IDs
// are now accepted at parse time (handlers reject them downstream).
export const vizConfigKindSchema = vizConfigKindSchemaBase.extend({
  version: z.string().optional().default(''),
  spec: z
    .object({
      options: z.record(z.string(), z.unknown()).optional().default({}),
      fieldConfig: fieldConfigSchema.optional().default({ defaults: {}, overrides: [] }),
    })
    .optional()
    .default({ options: {}, fieldConfig: { defaults: {}, overrides: [] } }),
});

// MIGRATION T2: re-export bundle schema, override spec to:
// - point at locally-extended `panelQueryKindSchema` (LLM-friendly query spec)
// - point at locally-kept `transformationKindSchema` (different protocol than CUE)
// - make `transformations`/`queryOptions` optional+default for LLM ergonomics
export const queryGroupKindSchema = queryGroupKindSchemaBase.extend({
  spec: queryGroupSpecSchema.extend({
    queries: z.array(panelQueryKindSchema),
    transformations: z.array(transformationKindSchema).optional().default([]),
    queryOptions: queryOptionsSpecSchema.optional().default({}),
  }),
});

// MIGRATION T2: re-export bundle schema with spec overrides:
// - .omit({ id: true }) — bundle has required `id`; mutation API auto-assigns
//   panel IDs and the field is documented as ignored.
// - description: optional+default('') for LLM ergonomics
// - links: optional+default([]) for LLM ergonomics
// - data/vizConfig: point at locally-extended versions
// - transparent: optional+default(false) for LLM ergonomics
export const panelKindSchema = panelKindSchemaBase.extend({
  spec: panelSpecSchema.omit({ id: true }).extend({
    description: z.string().optional().default(''),
    links: z.array(dataLinkSchema).optional().default([]),
    data: queryGroupKindSchema,
    vizConfig: vizConfigKindSchema,
    transparent: z.boolean().optional().default(false),
  }),
});

export const partialPanelKindSchema = z
  .object({
    kind: z.literal('Panel').optional().default('Panel'),
    spec: z.object({
      title: z.string().optional().describe('Panel title'),
      description: z.string().optional().describe('Panel description'),
      links: z.array(dataLinkSchema).optional().describe('Panel header links (replaces existing)'),
      data: z
        .object({
          kind: z.literal('QueryGroup').optional().default('QueryGroup'),
          spec: z.object({
            queries: z.array(panelQueryKindSchema).optional().describe('Replace all queries'),
            transformations: z.array(transformationKindSchema).optional().describe('Replace all transformations'),
            queryOptions: queryOptionsSpecSchema.optional().describe('Query options'),
          }),
        })
        .optional()
        .describe('Query group (partial). When provided, spec is required.'),
      vizConfig: z
        .object({
          kind: z.literal('VizConfig').optional().default('VizConfig'),
          group: z.string().optional().describe('Change plugin ID (e.g., "timeseries" to "stat")'),
          version: z.string().optional(),
          spec: z
            .object({
              options: z
                .record(z.string(), z.unknown())
                .optional()
                .describe('Panel options (deep-merged into existing)'),
              fieldConfig: fieldConfigSchema.optional().describe('Field config (deep-merged into existing)'),
            })
            .optional(),
        })
        .optional()
        .describe('Visualization configuration (partial)'),
      transparent: z.boolean().optional().describe('Whether the panel background is transparent'),
    }),
  })
  .describe('Partial panel update (all fields optional, only provided fields are applied)');

// Layout item schemas (v2beta1) — see MIGRATION_NOTES.md.
// `layoutItemInputSchema` is a mutation-API-only input variant derived from the
// canonical `gridLayoutItemKindSchema` (relaxed: optional kind, partial spec,
// extra `conditionalRendering` field for AutoGridLayout targets).

// MIGRATION T2: re-export bundle schema with z.int() → z.number() on x/y/width/height
// so LLM tools can submit fractional positions without rejection. Bundle's int()
// rejects floats; mutation API has historically been permissive here.
export const gridLayoutItemKindSchema = gridLayoutItemKindSchemaBase.extend({
  spec: gridLayoutItemSpecSchema.extend({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
}) satisfies z.ZodType<GridLayoutItemKind>;

// MIGRATION T1: re-export as-is. Behavior change: bundle's spec exposes an
// optional `conditionalRendering` field that the manual schema didn't. LLM
// tools may now provide it inline; mutation-API handlers ignore it (the
// canonical place for conditionalRendering on a panel is at the payload level).
export const autoGridLayoutItemKindSchema = autoGridLayoutItemKindSchemaBundle;

export const layoutItemInputSchema = z
  .object({
    kind: z
      .enum(['GridLayoutItem', 'AutoGridLayoutItem'])
      .optional()
      .describe(
        'Layout item type hint. If omitted, automatically determined from the target layout. ' +
          'A warning is emitted if the provided kind does not match the target layout.'
      ),
    spec: gridLayoutItemKindSchema.shape.spec
      .omit({ element: true })
      .extend({
        conditionalRendering: conditionalRenderingGroupKindSchema
          .optional()
          .describe(
            'Show/hide rules (Auto grid layout only). ' +
              'On ADD_PANEL, ignored with a warning if the target is not Auto grid. ' +
              'On UPDATE_PANEL, returns an error.'
          ),
      })
      .partial()
      .optional()
      .default({}),
  })
  .describe(
    'Layout item with optional sizing hints. The kind is optional and auto-detected from the target layout. ' +
      'For GridLayout targets, provide x/y/width/height in spec. For AutoGridLayout targets, position is auto-arranged.'
  );

export const updateLayoutPayloadSchema = z.object({
  path: layoutPathSchema.describe('Path to the layout node (e.g. "/", "/rows/0", "/tabs/0")'),
  layoutType: layoutTypeSchema
    .optional()
    .describe(
      'Target layout type. If omitted, keeps current type and just applies options. ' +
        'Group conversions: RowsLayout <-> TabsLayout. Grid conversions: GridLayout <-> AutoGridLayout.'
    ),
  options: autoGridOptionsSchema.optional().describe('AutoGridLayout properties. Rejected for other layout types.'),
});

// Panel payload schemas

export const addPanelPayloadSchema = z.object({
  panel: panelKindSchema.describe('Panel to add (v2beta1 PanelKind). The id field is ignored and auto-assigned.'),
  parentPath: layoutPathSchema
    .optional()
    .default('/')
    .describe('Path to the parent container. "/" for root, or e.g. "/rows/0", "/tabs/1" to add inside a group.'),
  layoutItem: layoutItemInputSchema
    .optional()
    .describe(
      'Layout item with sizing hints. The kind is adapted to match the target layout (warning emitted if converted). ' +
        'If omitted, defaults are used.'
    ),
});

export const updatePanelPayloadSchema = z
  .object({
    element: elementReferenceSchema.describe('Panel to update, identified by element name'),
    panel: partialPanelKindSchema
      .optional()
      .describe(
        'Partial panel update. Only provided fields are applied. Options and fieldConfig are deep-merged. ' +
          'Can be omitted when only setting conditionalRendering.'
      ),
    conditionalRendering: conditionalRenderingGroupKindSchema
      .optional()
      .describe('Show/hide rules for this panel (Auto grid layout only). Omit to leave unchanged.'),
  })
  .superRefine((data, ctx) => {
    if (!data.panel && data.conditionalRendering === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        message: 'At least one of panel or conditionalRendering must be provided.',
      });
    }
  });

export const removePanelPayloadSchema = z.object({
  elements: z.array(elementReferenceSchema).max(10).describe('Panels to remove, identified by element name'),
});

export const listPanelsPayloadSchema = z.object({
  elements: z
    .array(z.string())
    .optional()
    .describe('Element names to return (e.g. ["panel-1", "panel-5"]). Omit to return all.'),
  evaluateVariables: z
    .boolean()
    .optional()
    .default(false)
    .describe('When true, include evaluatedQueries with template variables resolved to current values'),
  includeStatus: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'When true, include runtime status (isLoading, hasError, hasNoData, errors) and data frame schema per panel'
    ),
});

export const movePanelPayloadSchema = z.object({
  element: elementReferenceSchema.describe('Element to move, identified by name'),
  toParent: layoutPathSchema
    .optional()
    .describe('Path to the destination group (e.g., "/rows/1", "/tabs/0/rows/2"). Stays in current group if omitted.'),
  layoutItem: layoutItemInputSchema
    .optional()
    .describe(
      'Layout item with sizing hints. The kind is adapted to match the target layout (warning emitted if converted). ' +
        'If omitted, preserves current dimensions.'
    ),
  /** @deprecated Use layoutItem instead */
  position: gridPositionSchema.optional().describe('DEPRECATED: Use layoutItem instead.'),
});

export const updateDashboardSettingsPayloadSchema = z.object({
  title: z.string().optional().describe('Dashboard title'),
  description: z.string().optional().describe('Dashboard description'),
  tags: z.array(z.string()).optional().describe('Dashboard tags'),
  refresh: z
    .string()
    .optional()
    .describe('Auto-refresh interval (e.g. "5s", "1m", "5m", "15m", "30m", "1h", "2h", "1d", "" to disable)'),
  timeRange: z
    .object({
      from: z.string().describe('Start of time range (e.g. "now-6h")'),
      to: z.string().describe('End of time range (e.g. "now")'),
    })
    .optional()
    .describe('Dashboard time range'),
  timezone: z.string().optional().describe('Timezone ("browser", "utc", or IANA timezone)'),
  editable: z.boolean().optional().describe('Whether the dashboard is editable'),
});

/**
 * Per-command payload schemas, accessible via DashboardMutationAPI.getPayloadSchema().
 *
 * Each value is a Zod schema with a `.describe()` annotation that serves
 * as the command description (flows into JSON Schema for LLM consumers).
 */
export const payloads = {
  addVariable: addVariablePayloadSchema.describe('Add a new template variable'),
  removeVariable: removeVariablePayloadSchema.describe('Remove a template variable'),
  updateVariable: updateVariablePayloadSchema.describe('Update an existing template variable'),
  listVariables: emptyPayloadSchema.describe('List all template variables on the dashboard'),
  enterEditMode: emptyPayloadSchema.describe('Enter dashboard edit mode'),
  getLayout: getLayoutPayloadSchema.describe('Get the dashboard layout tree and trimmed elements map'),
  addRow: addRowPayloadSchema.describe('Add a new row to the dashboard layout'),
  removeRow: removeRowPayloadSchema.describe('Remove a row from the dashboard layout'),
  updateRow: updateRowPayloadSchema.describe('Update a row in the dashboard layout'),
  moveRow: moveRowPayloadSchema.describe('Move or reorder a row in the dashboard layout'),
  addTab: addTabPayloadSchema.describe('Add a new tab to the dashboard layout'),
  removeTab: removeTabPayloadSchema.describe('Remove a tab from the dashboard layout'),
  updateTab: updateTabPayloadSchema.describe('Update a tab in the dashboard layout'),
  moveTab: moveTabPayloadSchema.describe('Move or reorder a tab in the dashboard layout'),
  updateLayout: updateLayoutPayloadSchema.describe('Update the layout type and/or properties at a given path'),
  addPanel: addPanelPayloadSchema.describe('Add a new panel to the dashboard'),
  updatePanel: updatePanelPayloadSchema.describe(
    'Update an existing panel (partial update, deep-merge for options/fieldConfig)'
  ),
  removePanel: removePanelPayloadSchema.describe('Remove one or more panels from the dashboard'),
  listPanels: listPanelsPayloadSchema.describe('List all panels on the dashboard with their layout items'),
  movePanel: movePanelPayloadSchema.describe(
    'Move a panel to a different group or reposition within the current group'
  ),
  getDashboardInfo: emptyPayloadSchema.describe('Get dashboard metadata (title, description, uid, tags, folder info)'),
  updateDashboardSettings: updateDashboardSettingsPayloadSchema.describe(
    'Update dashboard settings (title, description, tags, refresh, time range, timezone, editable)'
  ),
};
