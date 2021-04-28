export const SAMPLE_QUERIES = [
  {
    refId: 'A',
    queryType: '',
    relativeTimeRange: {
      from: 30,
      to: 0,
    },
    model: {
      datasource: 'gdev-testdata',
      datasourceUid: '000000004',
      intervalMs: 1000,
      maxDataPoints: 100,
      pulseWave: {
        offCount: 6,
        offValue: 1,
        onCount: 6,
        onValue: 10,
        timeStep: 5,
      },
      refId: 'A',
      scenarioId: 'predictable_pulse',
      stringInput: '',
    },
  },
  {
    refId: 'B',
    queryType: '',
    relativeTimeRange: {
      from: 0,
      to: 0,
    },
    model: {
      conditions: [
        {
          evaluator: {
            params: [3],
            type: 'gt',
          },
          operator: {
            type: 'and',
          },
          query: {
            params: ['A'],
          },
          reducer: {
            type: 'last',
          },
        },
      ],
      datasource: '__expr__',
      datasourceUid: '-100',
      intervalMs: 1000,
      maxDataPoints: 100,
      refId: 'B',
      type: 'classic_conditions',
    },
  },
];
