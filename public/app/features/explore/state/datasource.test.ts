import { DataSourceApi } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { ExploreId, ExploreItemState } from 'app/types';

import { updateDatasourceInstanceAction, datasourceReducer } from './datasource';
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
        QueryEditorHelp: StartPage,
      },
    } as DataSourceApi;
    const queries: DataQuery[] = [];
    const queryKeys: string[] = [];
    const initialState: ExploreItemState = {
      datasourceInstance: null,
      queries,
      queryKeys,
    } as unknown as ExploreItemState;

    const result = datasourceReducer(
      initialState,
      updateDatasourceInstanceAction({ exploreId: ExploreId.left, datasourceInstance, history: [] })
    );

    const expectedState: Partial<ExploreItemState> = {
      datasourceInstance,
      queries,
      queryKeys,
      graphResult: null,
      logsResult: null,
      tableResult: null,
      loading: false,
      queryResponse: {
        // When creating an empty query response we also create a timeRange object with the current time.
        // Copying the range from the reducer here prevents intermittent failures when creating them at different times.
        ...createEmptyQueryResponse(),
        timeRange: result.queryResponse.timeRange,
      },
    };

    expect(result).toMatchObject(expectedState);
  });
});
