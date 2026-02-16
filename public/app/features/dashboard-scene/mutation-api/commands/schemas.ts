/**
 * Dashboard Mutation API -- Canonical Zod Schemas & Payload Definitions
 *
 * This file contains two layers:
 *
 * 1. BUILDING-BLOCK SCHEMAS -- v2beta1 data structures (VariableKind, etc.)
 *    used internally by core code.
 *
 * 2. PAYLOAD SCHEMAS & `payloads` RECORD -- one Zod schema per mutation
 *    command, accessible via DashboardMutationAPI.getPayloadSchema().
 *
 * This file only depends on Zod, keeping it safe for import from any
 * internal module without pulling in the DashboardScene dependency tree.
 *
 * DEFAULTS: Literal `kind` and `version` fields use .optional().default()
 * so consumers (e.g. LLM tools) can omit boilerplate. After parsing, these
 * fields are always present in the output.
 *
 * The `.describe()` annotations flow into generated JSON Schema via
 * `z.toJSONSchema()` and are used by LLM tool consumers for guidance.
 */

import { z } from 'zod';

export const dataQueryKindSchema = z.object({
  kind: z.literal('DataQuery').optional().default('DataQuery'),
  group: z.string().describe('Datasource type (e.g., "prometheus", "loki", "mysql")'),
  version: z.string().optional().default('v0'),
  datasource: z
    .object({
      name: z.string().optional(),
    })
    .optional(),
  spec: z.record(z.string(), z.unknown()).describe('Query-specific fields (e.g., expr for Prometheus, rawSql for SQL)'),
});

// Variable building-block schemas (v2beta1)

export const variableOptionSchema = z.object({
  selected: z.boolean().optional().describe('Flag indicating if the value is selected'),
  text: z.string().or(z.array(z.string())).describe('The text or list of texts of the current value'),
  value: z.string().or(z.array(z.string())).describe('The value or list of values of the current value'),
  properties: z.record(z.string(), z.string()).optional().describe('Additional properties for multi-props variables'),
});

const variableHideSchema = z
  .enum(['dontHide', 'hideLabel', 'hideVariable', 'inControlsMenu'])
  .optional()
  .default('dontHide')
  .describe(
    `Flag indicating if the variable should be:
- "dontHide": show label and value (visible)
- "hideLabel": show value only (label hidden)
- "hideVariable": show nothing (fully hidden)
- "inControlsMenu": show in a drop-down menu`
  );

const variableRefreshSchema = z
  .enum(['never', 'onDashboardLoad', 'onTimeRangeChanged'])
  .optional()
  .default('never')
  .describe(
    `Options to config when to refresh a variable:
- "never": Never refresh the variable
- "onDashboardLoad": Queries the data source every time the dashboard loads
- "onTimeRangeChanged": Queries the data source when the dashboard time range changes`
  );

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
  .optional()
  .default('disabled')
  .describe(
    `Sort variable options. Accepted values are:
- "disabled": No sorting
- "alphabeticalAsc": Alphabetical ASC
- "alphabeticalDesc": Alphabetical DESC
- "numericalAsc": Numerical ASC
- "numericalDesc": Numerical DESC
- "alphabeticalCaseInsensitiveAsc": Alphabetical Case Insensitive ASC
- "alphabeticalCaseInsensitiveDesc": Alphabetical Case Insensitive DESC
- "naturalAsc": Natural ASC
- "naturalDesc": Natural DESC`
  );

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
      filters: z
        .array(adHocFilterSchema)
        .optional()
        .default([])
        .describe('User-configured ad-hoc filters applied to queries'),
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
    'AdhocVariable: Ad-hoc filter builder that adds key/value filters to all queries for a data source. Has top-level group and datasource fields for data source binding.'
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
};
