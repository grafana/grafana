import { updateDatasourceInstanceAction, datasourceReducer } from './datasource';
import { ExploreId, ExploreItemState } from 'app/types';
import { DataQuery, DataSourceApi } from '@grafana/data';
import { createEmptyQueryResponse } from './utils';

describe('Datasource reducer', () => {
  it('should handle set updateDatasourceInstanceAction correctly', () => {
    const StartPage = {};
    const datasourceInstance = {
      meta: {
        metrics: true,
        logs: true,
      },
      components: {
        ExploreStartPage: StartPage,
      },
    } as DataSourceApi;
    const queries: DataQuery[] = [];
    const queryKeys: string[] = [];
    const initialState: ExploreItemState = ({
      datasourceInstance: null,
      queries,
      queryKeys,
    } as unknown) as ExploreItemState;
    const expectedState: any = {
      datasourceInstance,
      queries,
      queryKeys,
      graphResult: null,
      logsResult: null,
      tableResult: null,
      latency: 0,
      loading: false,
      queryResponse: createEmptyQueryResponse(),
    };

    const result = datasourceReducer(
      initialState,
      updateDatasourceInstanceAction({ exploreId: ExploreId.left, datasourceInstance, history: [] })
    );
    expect(result).toMatchObject(expectedState);
  });
});
