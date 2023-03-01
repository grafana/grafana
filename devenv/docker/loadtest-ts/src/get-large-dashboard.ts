const testDash = {
  annotations: { list: [] },
  editable: true,
  fiscalYearStartMonth: 0,
  graphTooltip: 0,
  id: 100,
  links: [],
  liveNow: false,
  panels: [
    {
      datasource: {
        type: 'testdata',
        uid: 'testdata',
      },
      fieldConfig: {
        defaults: {
          color: {
            mode: 'thresholds',
          },
          custom: {
            align: 'auto',
            displayMode: 'auto',
            inspect: false,
          },
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
              },
              {
                color: 'red',
                value: 80,
              },
            ],
          },
        },
        overrides: [],
      },
      gridPos: {
        h: 9,
        w: 12,
        x: 0,
        y: 0,
      },
      id: 2,
      options: {
        footer: {
          fields: '',
          reducer: ['sum'],
          show: false,
        },
        showHeader: true,
      },
      pluginVersion: '9.4.0-pre',
      targets: [
        {
          csvContent: '',
          datasource: {
            type: 'testdata',
            uid: 'PD8C576611E62080A',
          },
          refId: 'A',
          scenarioId: 'csv_content',
        },
      ],
      title: 'Panel Title',
      type: 'table',
    },
  ],
  schemaVersion: 37,
  style: 'dark',
  tags: [],
  templating: {
    list: [],
  },
  time: {
    from: 'now-6h',
    to: 'now',
  },
  timepicker: {},
  timezone: '',
  title: 'New dashboard',
  uid: '5v6e5VH4z',
  version: 1,
  weekStart: '',
} as const;

const getCsvContent = (lengthInKb: number): string => {
  const lines: string[] = ['id,name'];
  for (let i = 0; i < lengthInKb; i++) {
    const prefix = `${i},`;
    lines.push(prefix + 'a'.repeat(1024 - prefix.length));
  }
  return lines.join('\n');
};

export const prepareDashboard = (lengthInKb: number): Record<string, unknown> => {
  const firstPanel = testDash.panels[0];
  return {
    ...testDash,
    panels: [
      {
        ...firstPanel,
        targets: [
          {
            ...firstPanel.targets[0],
            csvContent: getCsvContent(lengthInKb),
          },
        ],
      },
    ],
  };
};
