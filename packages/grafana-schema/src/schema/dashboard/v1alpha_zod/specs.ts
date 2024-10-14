import z from 'zod';
import { getDefaultsForSchema as zodDefaults } from 'zod-defaults';

import { KindSchema } from './common';

export const DashboardCursorSyncSchema = z.enum(['Off', 'Crosshair', 'Tooltip']).default('Off');
export type DashboardCursorSync = z.infer<typeof DashboardCursorSyncSchema>;

export const DashboardLinkSchema = KindSchema('DashboardLink', z.object({}));

export const QueryVariableSchema = KindSchema('QueryVariable', z.object({}));
export const TextVariableSchema = KindSchema('QueryVariable', z.object({}));

export const TimeSettingsSchema = KindSchema(
  'TimeSettings',
  z.object({
    timezone: z.string(),
    from: z.string(),
    to: z.string(),
    autoRefresh: z.string(),
    autoRefreshIntervals: z.array(z.string()),
    quickRanges: z.array(z.string()),
    hideTimepicker: z.boolean(),
    weekStart: z.string(),
    fiscalYearStartMonth: z.number(),
    nowDelay: z.string().optional(),
  })
);

export const timeSettingsDefaults = zodDefaults(TimeSettingsSchema);

export const VizConfigSchema = KindSchema(
  'VizConfig',
  z.object({
    pluginId: z.string().min(1),
    pluginVersion: z.string(),
    options: z.record(z.unknown()).default({}),
    fieldConfig: z
      .object({
        /** TODO schematise */
      })
      .default({
        defaults: {},
        overrides: [],
      }),
  })
);

const vizConfigDefaults = zodDefaults(VizConfigSchema);

export const PanelKindSchema = KindSchema(
  'Panel',
  z.object({
    uid: z.string(),
    title: z.string().min(1),
    description: z.string().min(1),
    links: z.array(DashboardLinkSchema),
    data: z.object({}).default({}), // TODO
    vizConfig: VizConfigSchema.default(vizConfigDefaults),
  })
);

export const ReferenceSchema = z.object({
  $ref: z.string(),
});

export const GridLayoutItemSchema = KindSchema(
  'GridLayoutItem',
  z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    element: ReferenceSchema,
  })
);

export const GridLayoutSchema = KindSchema(
  'GridLayout',
  z.object({
    items: z.array(GridLayoutItemSchema),
  })
);
