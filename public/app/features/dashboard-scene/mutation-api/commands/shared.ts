/**
 * Shared Zod building blocks for command payload schemas.
 *
 * These sub-schemas are reused across multiple commands. The `.describe()`
 * annotations flow into generated JSON Schema via `z.toJSONSchema()`.
 *
 * Schemas that map to v2beta1 types are annotated with `as unknown as z.ZodType<T>`
 * so that `z.infer<>` produces the proper v2beta1 type. This eliminates manual
 * casts in handler code while keeping Zod runtime validation and JSON Schema
 * generation unchanged.
 */

import { z } from 'zod';

import type {
  PanelKind,
  QueryGroupKind,
  VariableKind,
  VizConfigKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';

export const dataLinkSchema = z.object({
  title: z.string(),
  url: z.string(),
  targetBlank: z.boolean().optional(),
});

export const dataQueryKindSchema = z.object({
  kind: z.literal('DataQuery'),
  group: z.string().describe('Datasource type (e.g., "prometheus", "loki", "mysql")'),
  version: z.string(),
  datasource: z
    .object({
      name: z.string().optional(),
    })
    .optional(),
  spec: z.record(z.string(), z.unknown()).describe('Query-specific fields'),
});

export const fieldConfigSchema = z.object({
  defaults: z.record(z.string(), z.unknown()).optional(),
  overrides: z.array(z.any()).optional(),
});

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod validates structure at runtime; annotation aligns inferred type with v2beta1
export const vizConfigKindSchema = z.object({
  kind: z.literal('VizConfig'),
  group: z.string().describe('Plugin ID (e.g., "timeseries", "stat", "gauge", "table")'),
  version: z.string().optional(),
  spec: z.object({
    options: z.record(z.string(), z.unknown()).optional().describe('Visualization-specific options'),
    fieldConfig: fieldConfigSchema.optional().describe('Field configuration (units, thresholds, mappings)'),
  }),
}) as unknown as z.ZodType<VizConfigKind>;

export const panelQuerySchema = z.object({
  kind: z.literal('PanelQuery'),
  spec: z.object({
    query: dataQueryKindSchema,
    refId: z.string(),
    hidden: z.boolean().optional(),
  }),
});

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod validates structure at runtime; annotation aligns inferred type with v2beta1
export const queryGroupKindSchema = z.object({
  kind: z.literal('QueryGroup'),
  spec: z.object({
    queries: z.array(panelQuerySchema).optional(),
    transformations: z.array(z.any()).optional(),
    queryOptions: z.any().optional(),
  }),
}) as unknown as z.ZodType<QueryGroupKind>;

export const panelSpecSchema = z.object({
  title: z.string().describe('Panel title'),
  description: z.string().optional().describe('Panel description'),
  links: z.array(dataLinkSchema).optional(),
  data: queryGroupKindSchema.optional().describe('Query group with queries and transformations'),
  vizConfig: vizConfigKindSchema.describe('Visualization configuration'),
  transparent: z.boolean().optional().describe('Transparent background'),
});

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod validates structure at runtime; annotation aligns inferred type with v2beta1
export const panelKindSchema = z
  .object({
    kind: z.literal('Panel'),
    spec: panelSpecSchema,
  })
  .describe('Panel definition using PanelKind structure') as unknown as z.ZodType<PanelKind>;

export const gridPositionSchema = z
  .object({
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  })
  .describe('Panel position in the layout grid');

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod validates structure at runtime; annotation aligns inferred type with v2beta1
export const variableKindSchema = z.object({
  kind: z.string().describe('Variable type (e.g., "QueryVariable", "CustomVariable", "DatasourceVariable")'),
  spec: z.record(z.string(), z.unknown()).describe('Variable specification'),
}) as unknown as z.ZodType<VariableKind>;

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

export const emptyPayloadSchema = z.object({}).strict();
