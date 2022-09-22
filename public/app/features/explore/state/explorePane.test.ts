import { of } from 'rxjs';

import { serializeStateToUrlParam } from '@grafana/data';
import { setDataSourceSrv } from '@grafana/runtime';
import { ExploreId, StoreState, ThunkDispatch } from 'app/types';

import { configureStore } from '../../../store/configureStore';

import { refreshExplore } from './explorePane';
import { createDefaultInitialState } from './helpers';

jest.mock('../../dashboard/services/TimeSrv', () => ({
  getTimeSrv: jest.fn().mockReturnValue({
    init: jest.fn(),
    timeRange: jest.fn().mockReturnValue({}),
  }),
}));

const { testRange, defaultInitialState } = createDefaultInitialState();

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getTemplateSrv: () => ({
    updateTimeRange: jest.fn(),
  }),
}));

function setupStore(state?: any) {
  return configureStore({
    ...defaultInitialState,
    explore: {
      [ExploreId.left]: {
        ...defaultInitialState.explore[ExploreId.left],
        ...(state || {}),
      },
    },
  } as any);
}

function setup(state?: any) {
  const datasources: Record<string, any> = {
    newDs: {
      testDatasource: jest.fn(),
      init: jest.fn(),
      query: jest.fn(),
      name: 'newDs',
      meta: { id: 'newDs' },
      getRef: () => ({ uid: 'newDs' }),
    },
    someDs: {
      testDatasource: jest.fn(),
      init: jest.fn(),
      query: jest.fn(),
      name: 'someDs',
      meta: { id: 'someDs' },
      getRef: () => ({ uid: 'someDs' }),
    },
  };

  setDataSourceSrv({
    getList() {
      return Object.values(datasources).map((d) => ({ name: d.name }));
    },
    getInstanceSettings(name: string) {
      return { name, getRef: () => ({ uid: name }) };
    },
    get(name?: string) {
      return Promise.resolve(
        name
          ? datasources[name]
          : {
              testDatasource: jest.fn(),
              init: jest.fn(),
              name: 'default',
              getRef() {
                return { type: 'default', uid: 'default' };
              },
            }
      );
    },
  } as any);

  const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = setupStore({
    datasourceInstance: datasources.someDs,
    ...(state || {}),
  });

  return {
    dispatch,
    getState,
    datasources,
  };
}

describe('refreshExplore', () => {
  it('should change data source when datasource in url changes', async () => {
    const { dispatch, getState } = setup();
    await dispatch(
      refreshExplore(ExploreId.left, serializeStateToUrlParam({ datasource: 'newDs', queries: [], range: testRange }))
    );
    expect(getState().explore[ExploreId.left].datasourceInstance?.name).toBe('newDs');
  });

  it('should change and run new queries from the URL', async () => {
    const { dispatch, getState, datasources } = setup();
    datasources.someDs.query.mockReturnValueOnce(of({}));
    await dispatch(
      refreshExplore(
        ExploreId.left,
        serializeStateToUrlParam({ datasource: 'someDs', queries: [{ expr: 'count()', refId: 'A' }], range: testRange })
      )
    );
    // same
    const state = getState().explore[ExploreId.left];
    expect(state.datasourceInstance?.name).toBe('someDs');
    expect(state.queries.length).toBe(1);
    expect(state.queries).toMatchObject([{ expr: 'count()' }]);
    expect(datasources.someDs.query).toHaveBeenCalledTimes(1);
  });

  it('should not do anything if pane is not initialized', async () => {
    const { dispatch, getState } = setup({
      initialized: false,
    });
    const state = getState();
    await dispatch(
      refreshExplore(
        ExploreId.left,
        serializeStateToUrlParam({ datasource: 'newDs', queries: [{ expr: 'count()', refId: 'A' }], range: testRange })
      )
    );

    expect(state).toEqual(getState());
  });
});
