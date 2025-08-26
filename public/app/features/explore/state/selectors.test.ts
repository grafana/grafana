import { DataSourceApi, DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema/dist/esm/index';
import { configureStore } from 'app/store/configureStore';
import { StoreState, ThunkDispatch } from 'app/types/store';

import { selectExploreDSMaps } from './selectors';
import { createDefaultInitialState } from './testHelpers';

const { defaultInitialState } = createDefaultInitialState();

const datasources: DataSourceApi[] = [
  {
    name: 'testDs',
    type: 'postgres',
    uid: 'ds1',
    getRef: () => {
      return { type: 'postgres', uid: 'ds1' };
    },
  } as DataSourceApi<DataQuery, DataSourceJsonData, {}>,
  {
    name: 'testDs2',
    type: 'mysql',
    uid: 'ds2',
    getRef: () => {
      return { type: 'mysql', uid: 'ds2' };
    },
  } as DataSourceApi<DataQuery, DataSourceJsonData, {}>,
];

describe('selectExploreDSMaps', () => {
  it('returns datasource information as empty with empty state', () => {
    const store: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore();

    const dsMaps = selectExploreDSMaps(store.getState());
    expect(dsMaps.dsToExplore).toEqual([]);
    expect(dsMaps.exploreToDS).toEqual([]);
  });

  it('returns root datasources from 2 panes with empty queries', () => {
    const store: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
      ...defaultInitialState,
      explore: {
        panes: {
          left: {
            ...defaultInitialState.explore.panes.left,
            datasourceInstance: datasources[0],
            queries: [],
          },
          right: {
            ...defaultInitialState.explore.panes.left,
            datasourceInstance: datasources[1],
            queries: [],
          },
        },
      },
    } as unknown as Partial<StoreState>);

    const dsMaps = selectExploreDSMaps(store.getState());
    expect(dsMaps.dsToExplore.length).toEqual(2);

    // ds 1
    expect(dsMaps.dsToExplore[0].datasource.uid).toEqual('ds1');
    expect(dsMaps.dsToExplore[0].exploreIds.length).toEqual(1);
    expect(dsMaps.dsToExplore[0].exploreIds[0]).toEqual('left');
    // ds 2
    expect(dsMaps.dsToExplore[1].datasource.uid).toEqual('ds2');
    expect(dsMaps.dsToExplore[1].exploreIds.length).toEqual(1);
    expect(dsMaps.dsToExplore[1].exploreIds[0]).toEqual('right');

    expect(dsMaps.exploreToDS.length).toEqual(2);
    // pane 1
    expect(dsMaps.exploreToDS[0].exploreId).toEqual('left');
    expect(dsMaps.exploreToDS[0].datasources.length).toEqual(1);
    expect(dsMaps.exploreToDS[0].datasources[0].uid).toEqual('ds1');
    //pane 2
    expect(dsMaps.exploreToDS[1].exploreId).toEqual('right');
    expect(dsMaps.exploreToDS[1].datasources.length).toEqual(1);
    expect(dsMaps.exploreToDS[1].datasources[0].uid).toEqual('ds2');
  });

  it('returns all datasources from 2 panes with queries', () => {
    const store: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
      ...defaultInitialState,
      explore: {
        panes: {
          different: {
            ...defaultInitialState.explore.panes.left,
            datasourceInstance: datasources[0],
            queries: [{ datasource: datasources[1] }],
          },
          match: {
            ...defaultInitialState.explore.panes.left,
            datasourceInstance: datasources[1],
            queries: [{ datasource: datasources[1] }],
          },
        },
      },
    } as unknown as Partial<StoreState>);

    const dsMaps = selectExploreDSMaps(store.getState());
    expect(dsMaps.dsToExplore.length).toEqual(2);
    // ds 1
    expect(dsMaps.dsToExplore[0].datasource.uid).toEqual('ds1');
    expect(dsMaps.dsToExplore[0].exploreIds.length).toEqual(1);
    expect(dsMaps.dsToExplore[0].exploreIds[0]).toEqual('different');
    // ds2
    expect(dsMaps.dsToExplore[1].datasource.uid).toEqual('ds2');
    expect(dsMaps.dsToExplore[1].exploreIds.length).toEqual(2);
    expect(dsMaps.dsToExplore[1].exploreIds[0]).toEqual('different');
    expect(dsMaps.dsToExplore[1].exploreIds[1]).toEqual('match');

    expect(dsMaps.exploreToDS.length).toEqual(2);
    // pane 1
    expect(dsMaps.exploreToDS[0].exploreId).toEqual('different');
    expect(dsMaps.exploreToDS[0].datasources.length).toEqual(2);
    expect(dsMaps.exploreToDS[0].datasources[0].uid).toEqual('ds1');
    expect(dsMaps.exploreToDS[0].datasources[1].uid).toEqual('ds2');
    // pane 2
    expect(dsMaps.exploreToDS[1].exploreId).toEqual('match');
    expect(dsMaps.exploreToDS[1].datasources.length).toEqual(1);
    expect(dsMaps.exploreToDS[1].datasources[0].uid).toEqual('ds2');
  });
});
