import { DefaultTimeZone, toUtc } from '@grafana/data';

import { ExploreId, SupplementaryQueryType } from '../../../types';

export const createDefaultInitialState = () => {
  const t = toUtc();
  const testRange = {
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
      timeZone: DefaultTimeZone,
    },
    explore: {
      [ExploreId.left]: {
        datasourceInstance: {
          query: jest.fn(),
          getRef: jest.fn(),
          getLogsVolumeDataProvider: jest.fn(),
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
        },
      },
    },
  };

  return { testRange, defaultInitialState };
};
