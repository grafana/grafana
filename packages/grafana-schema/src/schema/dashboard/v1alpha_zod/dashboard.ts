import z from 'zod';
import { getDefaultsForSchema as zodDefaults } from 'zod-defaults';

import { KindSchema } from './common';
import {
  DashboardCursorSyncSchema,
  DashboardLinkSchema,
  GridLayoutSchema,
  PanelKindSchema,
  QueryVariableSchema,
  TextVariableSchema,
  timeSettingsDefaults,
  TimeSettingsSchema,
} from './specs';

const DashboardSpec = z.object({
  uid: z.string().describe('Unique identifier for the dashboard'),
  id: z.number().optional(),
  title: z.string().describe('Title of the dashboard'),
  description: z.string().describe('Description of the dashboard'),
  cursorSync: DashboardCursorSyncSchema.default('Off'),
  liveNow: z.boolean().default(false),
  preload: z.boolean().default(false),
  editable: z.boolean().default(true),
  links: z.array(DashboardLinkSchema).default([]),
  tags: z.array(z.string()).default([]),
  timeSettings: TimeSettingsSchema.default(timeSettingsDefaults),
  variables: z.array(z.union([QueryVariableSchema, TextVariableSchema /** ... */])).default([]),
  elements: z.record(PanelKindSchema /** union in the future... */).default({}),
  layout: GridLayoutSchema /** union in the future */,
});

const DashboardSchema = KindSchema('Dashboard', DashboardSpec);

export type DashboardV2 = z.infer<typeof DashboardSchema>;

export const defaultDashboardV2: DashboardV2 = zodDefaults(DashboardSchema);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handTestingSchema: DashboardV2 = {
  kind: 'Dashboard',
  spec: {
    ...defaultDashboardV2.spec,
    id: 1,
    uid: 'default',
    title: 'Default Dashboard',
    description: 'This is a default dashboard',
    cursorSync: 'Off',
    liveNow: false,
    preload: false,
    editable: true,
    links: [],
    tags: [],
    timeSettings: {
      kind: 'TimeSettings',
      spec: {
        timezone: 'browser',
        from: 'now-6h',
        to: 'now',
        autoRefresh: '10s',
        autoRefreshIntervals: ['10s', '1m', '5m', '15m', '30m', '1h', '6h', '12h', '1d'],
        quickRanges: ['now/d', 'now/w', 'now/M', 'now/y'],
        hideTimepicker: false,
        weekStart: 'sunday',
        fiscalYearStartMonth: 1,
      },
    },

    elements: {
      timeSeriesTest: {
        kind: 'Panel',
        spec: {
          title: 'Time Series Test',
          description: 'This is a test panel',
          uid: 'timeSeriesTest',
          links: [],
          data: {
            // TODO
          },
          vizConfig: {
            kind: 'VizConfig',
            spec: {
              pluginId: 'timeseries',
              pluginVersion: '11.0.0',
              options: {},
              fieldConfig: {
                defaults: {},
                overrides: [],
              },
            },
          },
        },
      },
    },
    layout: {
      kind: 'GridLayout',
      spec: {
        items: [
          {
            kind: 'GridLayoutItem',
            spec: {
              element: { $ref: '#/spec/elements/0' },
              x: 0,
              y: 0,
              width: 12,
              height: 6,
            },
          },
        ],
      },
    },
    variables: [],
  },
};
