import { DashboardLoaderSupport } from 'app/features/dashboard/types';
import { DashboardDTO } from 'app/types';
import { of } from 'rxjs';

export const loader: DashboardLoaderSupport = {
  loadDashboard: (path: string) => {
    console.log('LOAD', path);
    return of(superSimple as DashboardDTO);
  },
};

const superSimple = {
  meta: {
    type: 'db',
    canSave: false,
    canEdit: true,
    canAdmin: true,
    canStar: true,
    slug: 'simple2',
    created: '2020-09-21T20:56:52-07:00',
    updated: '2020-09-21T20:56:52-07:00',
    updatedBy: 'admin',
    createdBy: 'admin',
    version: 1,
    hasAcl: false,
    isFolder: false,
    folderId: 0,
    folderTitle: 'General',
    folderUrl: '',
    provisioned: true, // <--------------------- This makes it not saveable!
    provisionedExternalId: '',
  },
  dashboard: {
    annotations: {
      list: [
        {
          builtIn: 1,
          datasource: '-- Grafana --',
          enable: true,
          hide: true,
          iconColor: 'rgba(0, 211, 255, 1)',
          name: 'Annotations \u0026 Alerts',
          type: 'dashboard',
        },
      ],
    },
    editable: true,
    gnetId: null,
    graphTooltip: 0,
    hideControls: false,
    id: 155,
    links: [],
    panels: [
      {
        datasource: null,
        fieldConfig: {
          defaults: {
            custom: {},
            mappings: [],
            thresholds: {
              mode: 'absolute',
              steps: [
                { color: 'green', value: null },
                { color: 'red', value: 80 },
              ],
            },
          },
          overrides: [],
        },
        gridPos: { h: 9, w: 12, x: 0, y: 0 },
        id: 2,
        options: {
          reduceOptions: { calcs: ['mean'], fields: '', values: false },
          showThresholdLabels: false,
          showThresholdMarkers: true,
        },
        pluginVersion: '7.3.0-pre',
        targets: [{ refId: 'A', scenarioId: 'random_walk' }],
        timeFrom: null,
        timeShift: null,
        title: 'simple simple simple',
        type: 'gauge',
      },
    ],
    schemaVersion: 26,
    style: 'dark',
    tags: [],
    templating: { list: [] },
    time: { from: 'now-6h', to: 'now' },
    timepicker: {},
    timezone: '',
    title: 'simple2',
    uid: '1dDxsrdGk',
    version: 1,
  },
};
