import { TimeRange, toUtc, SupplementaryQueryType } from '@grafana/data';
import { defaultTimeZone } from '@grafana/schema';

export const createDefaultInitialState = () => {
  const t = toUtc();
  const testRange: TimeRange = {
    from: t,
    to: t,
    raw: {
      from: t,
      to: t,
    },
  };

  const defaultInitialState = {
    user: {
      orgId: '1',
      timeZone: defaultTimeZone,
    },
    explore: {
      panes: {
        left: {
          datasourceInstance: {
            query: jest.fn(),
            getRef: jest.fn(),
            getDataProvider: jest.fn(),
            getSupportedSupplementaryQueryTypes: jest
              .fn()
              .mockImplementation(() => [SupplementaryQueryType.LogsVolume, SupplementaryQueryType.LogsSample]),
            getSupplementaryQuery: jest.fn(),
            meta: {
              id: 'something',
            },
          },
          initialized: true,
          containerWidth: 1920,
          eventBridge: { emit: () => {} },
          queries: [{ expr: 'test' }],
          range: testRange,
          history: [],
          refreshInterval: {
            label: 'Off',
            value: 0,
          },
          cache: [],
          richHistory: [],
          supplementaryQueries: {
            [SupplementaryQueryType.LogsVolume]: {
              enabled: true,
            },
            [SupplementaryQueryType.LogsSample]: {
              enabled: true,
            },
          },
        },
      },
    },
  };

  return { testRange, defaultInitialState };
};
