export const SAMPLE_QUERIES = [
  {
    refId: 'A',
    queryType: '',
    relativeTimeRange: {
      from: 21600,
      to: 0,
    },
    datasourceUid: '6_hUDNQGz',
    model: {
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
    datasourceUid: '-100',
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
      intervalMs: 1000,
      maxDataPoints: 100,
      refId: 'B',
      type: 'classic_conditions',
    },
  },
];
