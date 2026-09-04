import { of } from 'rxjs';

import { type DataSourceApi, type DataSourceJsonData, type DataSourcePluginMeta } from '@grafana/data';
import { type DataQuery, type DataSourceRef } from '@grafana/schema';
import { configureStore } from 'app/store/configureStore';
import { type StoreState, type ThunkDispatch } from 'app/types/store';

import { changeDatasource } from './datasource';
import { createDefaultInitialState } from './testHelpers';

const promA: DataSourceApi = {
  name: 'Prometheus A',
  type: 'prometheus',
  uid: 'prom-a',
  meta: { id: 'prometheus' } as DataSourcePluginMeta,
  getRef: () => ({ type: 'prometheus', uid: 'prom-a' }),
  query: jest.fn().mockReturnValue(of({ data: [] })),
  init: jest.fn(),
} as unknown as DataSourceApi<DataQuery, DataSourceJsonData, {}>;

const promB: DataSourceApi = {
  name: 'Prometheus B',
  type: 'prometheus',
  uid: 'prom-b',
  meta: { id: 'prometheus' } as DataSourcePluginMeta,
  getRef: () => ({ type: 'prometheus', uid: 'prom-b' }),
  query: jest.fn().mockReturnValue(of({ data: [] })),
  init: jest.fn(),
} as unknown as DataSourceApi<DataQuery, DataSourceJsonData, {}>;

const datasources = [promA, promB];

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: (ref?: DataSourceRef | string) => {
    if (!ref) {
      return Promise.resolve(datasources[0]);
    }
    return Promise.resolve(
      datasources.find((ds) => (typeof ref === 'string' ? ds.uid === ref : ds.uid === ref.uid)) || datasources[0]
    );
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    updateTimeRange: jest.fn(),
  }),
  getDataSourceSrv: () => ({
    get: (ref?: DataSourceRef | string) => {
      if (!ref) {
        return datasources[0];
      }
      return datasources.find((ds) => (typeof ref === 'string' ? ds.uid === ref : ds.uid === ref.uid)) || datasources[0];
    },
  }),
  reportInteraction: jest.fn(),
}));

jest.mock('app/features/correlations/utils', () => ({
  getCorrelationsFromStorage: jest.fn().mockResolvedValue({ correlations: [] }),
}));

jest.mock('app/core/history/richHistoryStorageProvider', () => ({
  getLocalRichHistoryStorage: () => ({
    getRichHistory: jest.fn().mockResolvedValue({ richHistory: [] }),
  }),
}));

jest.mock('app/features/dashboard/services/TimeSrv', () => ({
  ...jest.requireActual('app/features/dashboard/services/TimeSrv'),
  getTimeSrv: () => ({
    init: jest.fn(),
    timeRange: jest.fn().mockReturnValue({}),
  }),
}));

describe('changeDatasource', () => {
  const { defaultInitialState } = createDefaultInitialState();

  it('updates query-level datasource UIDs when switching between same-type datasources', async () => {
    const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
      ...defaultInitialState,
      explore: {
        panes: {
          left: {
            ...defaultInitialState.explore.panes.left,
            datasourceInstance: promA,
            queries: [{ refId: 'A', expr: 'up', datasource: { type: 'prometheus', uid: 'prom-a' } }],
            querySubscription: undefined,
            isLive: false,
          },
        },
      },
    } as unknown as Partial<StoreState>);

    await dispatch(
      changeDatasource({
        exploreId: 'left',
        datasource: 'prom-b',
        options: { importQueries: true },
      })
    );

    const pane = getState().explore.panes.left!;
    expect(pane.datasourceInstance?.uid).toBe('prom-b');
    expect(pane.queries[0].datasource?.uid).toBe('prom-b');
    expect(pane.queries[0].datasource?.type).toBe('prometheus');
  });

  it('realigns stale query UIDs even when importQueries is not requested', async () => {
    const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
      ...defaultInitialState,
      explore: {
        panes: {
          left: {
            ...defaultInitialState.explore.panes.left,
            datasourceInstance: promA,
            queries: [{ refId: 'A', expr: 'up', datasource: { type: 'prometheus', uid: 'prom-a' } }],
            querySubscription: undefined,
            isLive: false,
          },
        },
      },
    } as unknown as Partial<StoreState>);

    await dispatch(
      changeDatasource({
        exploreId: 'left',
        datasource: 'prom-b',
      })
    );

    const pane = getState().explore.panes.left!;
    expect(pane.datasourceInstance?.uid).toBe('prom-b');
    expect(pane.queries[0].datasource?.uid).toBe('prom-b');
  });
});
