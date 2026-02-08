/**
 * Dashboard Mutation API -- Canonical Zod Schemas
 *
 * These schemas define the v2beta1 data structures used by mutation commands
 * (PanelKind, VizConfigKind, QueryGroupKind, VariableKind, etc.).
 *
 * WHY THESE ARE ALSO EXPORTED VIA @grafana/runtime:
 *
 * The MutationClient (getDashboardMutationAPI()) is only available at runtime
 * after a dashboard has been loaded and activated. However, consumers like
 * the Grafana Assistant need these schemas at module load time -- before any
 * dashboard exists -- to define their tool input schemas for the LLM.
 *
 * These schemas are re-exported through DashboardMutationAPI.schemas in
 * @grafana/runtime so external consumers (plugins) can import and compose
 * them without waiting for the MutationClient to be ready.
 *
 * Within grafana core, import directly from this file -- do NOT use
 * DashboardMutationAPI.schemas (that namespace is only for external consumers).
 *
 * DEFAULTS: Literal `kind` and `version` fields use .optional().default()
 * so consumers (e.g. LLM tools) can omit boilerplate. After parsing, these
 * fields are always present in the output.
 *
 * The `.describe()` annotations flow into generated JSON Schema via
 * `z.toJSONSchema()` and are used by LLM tool consumers for guidance.
 */

import { z } from 'zod';

export const dataLinkSchema = z.object({
  title: z.string(),
  url: z.string(),
  targetBlank: z.boolean().optional(),
});

export const dataQueryKindSchema = z.object({
  kind: z.literal('DataQuery').optional().default('DataQuery'),
  group: z.string().describe('Datasource type (e.g., "prometheus", "loki", "mysql")'),
  version: z.string().optional().default(''),
  datasource: z
    .object({
      name: z.string().optional(),
    })
    .optional(),
  spec: z.record(z.string(), z.unknown()).describe('Query-specific fields (e.g., expr for Prometheus, rawSql for SQL)'),
});

export const fieldConfigSchema = z.object({
  defaults: z.record(z.string(), z.unknown()).optional(),
  overrides: z.array(z.any()).optional(),
});

export const vizConfigKindSchema = z.object({
  kind: z.literal('VizConfig').optional().default('VizConfig'),
  group: z.string().describe('Plugin ID (e.g., "timeseries", "stat", "gauge", "table")'),
  version: z.string().optional().default(''),
  spec: z.object({
    options: z.record(z.string(), z.unknown()).optional().describe('Visualization-specific options'),
    fieldConfig: fieldConfigSchema.optional().describe('Field configuration (units, thresholds, mappings)'),
  }),
});

export const panelQuerySchema = z.object({
  kind: z.literal('PanelQuery').optional().default('PanelQuery'),
  spec: z.object({
    query: dataQueryKindSchema,
    refId: z.string().describe('Reference ID for the query (e.g., "A", "B")'),
    hidden: z.boolean().optional().default(false),
  }),
});

export const transformationKindSchema = z.object({
  kind: z.string().describe('The transformation ID (e.g., "organize", "groupBy", "merge")'),
  spec: z.object({
    id: z.string().describe('Transformation identifier (same as kind)'),
    disabled: z.boolean().optional().default(false).describe('Whether the transformation is disabled'),
    filter: z.any().optional().describe('Optional frame matcher'),
    options: z.record(z.string(), z.unknown()).optional().default({}).describe('Transformation-specific options'),
  }),
});

export const queryGroupKindSchema = z.object({
  kind: z.literal('QueryGroup').optional().default('QueryGroup'),
  spec: z.object({
    queries: z.array(panelQuerySchema).optional().describe('The query targets for the panel'),
    transformations: z
      .array(transformationKindSchema)
      .optional()
      .describe('The transformations to apply in v2beta1 format'),
    queryOptions: z.any().optional(),
  }),
});

export const panelSpecSchema = z.object({
  id: z.number().optional().describe('Panel ID (auto-generated if not provided)'),
  title: z.string().describe('Panel title'),
  description: z.string().optional().describe('Panel description'),
  links: z.array(dataLinkSchema).optional().default([]),
  data: queryGroupKindSchema.optional().describe('Query group with queries and transformations'),
  vizConfig: vizConfigKindSchema.describe('Visualization configuration including plugin type and options'),
  transparent: z.boolean().optional().default(false).describe('Transparent background'),
});

export const panelKindSchema = z
  .object({
    kind: z.literal('Panel').optional().default('Panel'),
    spec: panelSpecSchema,
  })
  .describe('Panel definition using PanelKind structure');

export const gridPositionSchema = z
  .object({
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  })
  .describe('Panel position in the layout grid');

export const variableKindSchema = z.object({
  kind: z.string().describe('Variable type (e.g., "QueryVariable", "CustomVariable", "DatasourceVariable")'),
  spec: z.record(z.string(), z.unknown()).describe('Variable specification'),
});

export const dashboardLinkSchema = z.object({
  title: z.string().describe('Link title'),
  type: z.string().describe('Link type: "link" or "dashboards"'),
  url: z.string().optional().describe('URL (for type "link")'),
  icon: z.string().optional().describe('Icon name'),
  tooltip: z.string().optional().describe('Tooltip text'),
  tags: z.array(z.string()).optional().describe('Dashboard tag filter (for type "dashboards")'),
  asDropdown: z.boolean().optional().describe('Show as dropdown'),
  targetBlank: z.boolean().optional().describe('Open in new tab'),
  includeVars: z.boolean().optional().describe('Include template variables in URL'),
  keepTime: z.boolean().optional().describe('Include time range in URL'),
});

export const timeSettingsSchema = z.object({
  from: z.string().optional().describe('Start time (e.g., "now-6h", "now-1d")'),
  to: z.string().optional().describe('End time (e.g., "now")'),
  timezone: z.string().optional().describe('Timezone (e.g., "browser", "utc", "America/New_York")'),
  autoRefresh: z.string().optional().describe('Auto-refresh interval (e.g., "5s", "1m", "" to disable)'),
  autoRefreshIntervals: z.array(z.string()).optional(),
  quickRanges: z.array(z.any()).optional(),
  hideTimepicker: z.boolean().optional(),
  weekStart: z.string().optional(),
  fiscalYearStartMonth: z.number().optional(),
  nowDelay: z.string().optional(),
});

export const dashboardSettingsSchema = z.object({
  title: z.string().optional().describe('Dashboard title'),
  description: z.string().optional().describe('Dashboard description'),
  tags: z.array(z.string()).optional().describe('Dashboard tags'),
  editable: z.boolean().optional().describe('Whether the dashboard is editable'),
  preload: z.boolean().optional().describe('Whether to preload all panels'),
  liveNow: z.boolean().optional().describe('Enable live data redraw mode'),
  cursorSync: z.enum(['Off', 'Crosshair', 'Tooltip']).optional().describe('Cursor sync behavior across panels'),
  links: z.array(dashboardLinkSchema).optional().describe('Dashboard links (to other dashboards or external URLs)'),
  timeSettings: timeSettingsSchema.optional().describe('Time range and refresh settings'),
});

export const emptyPayloadSchema = z.object({}).strict();
