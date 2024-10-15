import { DashboardCursorSync, DashboardLink } from '../../../index.gen';

import { Kind } from './common';
import { AnnotationKind, GridLayoutKind, PanelKind, QueryVariableKind, TextVariableKind } from './kinds';
import { TimeSettingsSpec } from './specs';

export type DashboardV2 = Kind<'Dashboard', DashboardSpec>;

type Referenceable<T> = Record<string, T>;

interface DashboardSpec {
  uid: string;
  id?: number;

  // dashboard settings
  title: string;
  description: string;
  cursorSync: DashboardCursorSync;
  liveNow: boolean;
  preload: boolean;
  editable: boolean;
  links: DashboardLink[];
  tags: string[];
  // EOf dashboard settings

  timeSettings: TimeSettingsSpec;
  variables: Array<QueryVariableKind | TextVariableKind /* | ... */>;
  elements: Referenceable<PanelKind /** | ... more element types in the future? */>;
  annotations: AnnotationKind[];
  layout: GridLayoutKind;

  // annotations: AnnotationKind[];
  // version: will rely on k8s resource versioning, via metadata.resorceVersion?
  // revision?: number; // for plugins only
  // gnetId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handTestingSchema: DashboardV2 = {
  kind: 'Dashboard',
  spec: {
    id: 1,
    uid: 'default',
    title: 'Default Dashboard',
    description: 'This is a default dashboard',
    cursorSync: 0,
    liveNow: false,
    preload: false,
    editable: true,
    links: [],
    tags: [],
    timeSettings: {
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

    elements: {
      timeSeriesTest: {
        kind: 'Panel',
        spec: {
          title: 'Time Series Test',
          description: 'This is a test panel',
          uid: 'timeSeriesTest',
          links: [],
          data: {
            kind: 'QueryGroup',
            spec: {
              queries: [
                {
                  kind: 'PrometheusQuery',
                  spec: {
                    refId: 'A',
                    datasource: { uid: 'skdjkasjdkj', type: 'prometheus' },
                  },
                },
              ],
              transformations: [
                {
                  kind: 'LimitTransformation',
                  spec: {
                    id: 'limit', // id is competing w/ kind
                    options: {
                      limit: 10,
                    },
                  },
                },
              ],
              queryOptions: {},
            },
          },
          vizConfig: {
            kind: 'timeseries', // TimeseriesConfig | BarChartConfig eventually?
            spec: {
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
              element: { $ref: '#/spec/elements/timeSeriesTest' },
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
    annotations: [],
  },
};
