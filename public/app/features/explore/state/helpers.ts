import { DateTime, DefaultTimeZone, toUtc } from '@grafana/data';

import { ExploreId, SupplementaryQueryType } from '../../../types';

export interface DefaultInitialStateInterface {
  user: {
    orgId: string;
    timeZone: string;
  };
  explore: {
    [ExploreId.left]: {
      datasourceInstance?: {
        query?: () => void;
        getRef?: () => void;
        getLogsVolumeDataProvider?: () => void;
        meta?: {
          id?: string;
        };
      };
      initialized?: boolean;
      containerWidth?: number;
      eventBridge?: { emit?: {} };
      queries?: [{ expr?: string }];
      range?: {
        from?: DateTime;
        to?: DateTime;
        raw?: {
          from?: DateTime;
          to?: DateTime;
        };
      };
      history?: [];
      refreshInterval?: {
        label?: string;
        value?: number;
      };
      cache?: [];
      richHistory?: [];
      supplementaryQueries?: {
        [SupplementaryQueryType.LogsVolume]?: {
          enabled?: boolean;
        };
      };
    };
  };
}

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

  const defaultInitialState: DefaultInitialStateInterface = {
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
