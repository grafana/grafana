export function makeNewDashboardRequestBody(dashboardName: string, folderUid?: string) {
  return {
    dashboard: {
      annotations: {
        list: [
          {
            builtIn: 1,
            datasource: { type: 'grafana', uid: '-- Grafana --' },
            enable: true,
            hide: true,
            iconColor: 'rgba(0, 211, 255, 1)',
            name: 'Annotations & Alerts',
            type: 'dashboard',
          },
        ],
      },
      editable: true,
      fiscalYearStartMonth: 0,
      graphTooltip: 0,
      links: [],
      liveNow: false,
      panels: [
        {
          datasource: { type: 'testdata', uid: '89_jzlT4k' },
          gridPos: { h: 9, w: 12, x: 0, y: 0 },
          id: 2,
          options: {
            code: {
              language: 'plaintext',
              showLineNumbers: false,
              showMiniMap: false,
            },
            content: '***A nice little happy empty dashboard***',
            mode: 'markdown',
          },
          pluginVersion: '9.4.0-pre',
          title: 'Nothing to see here',
          type: 'text',
        },
      ],
      refresh: '',
      revision: 1,
      schemaVersion: 38,
      tags: [],
      templating: { list: [] },
      time: { from: 'now-6h', to: 'now' },
      timepicker: {},
      timezone: '',
      title: dashboardName,
      version: 0,
      uid: '',
      weekStart: '',
    },
    message: '',
    overwrite: false,
    folderUid,
  } as const;
}
