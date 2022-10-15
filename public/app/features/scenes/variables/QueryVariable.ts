import { v4 as uuidv4 } from 'uuid';

import { CoreApp, DataQuery, DataQueryRequest, LoadingState } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { runRequest } from 'app/features/query/state/runRequest';
import { hasLegacyVariableSupport } from 'app/features/variables/guard';

import { SceneObjectBase } from '../core/SceneObjectBase';

import { SceneVariable, SceneVariableState, VariableUpdateContext } from './types';

export interface QueryVariableState extends SceneVariableState {
  query: DataQuery;
}

export class QueryVariable extends SceneObjectBase<QueryVariableState> implements SceneVariable {
  async update(ctx: VariableUpdateContext) {
    const { query } = this.state;
    const range = this.getTimeRange();

    try {
      this.setState({ state: LoadingState.Loading });

      const dataSource = await getDataSourceSrv().get(query.datasource);

      const request: DataQueryRequest = {
        app: CoreApp.Dashboard,
        requestId: uuidv4(),
        timezone: range.state.timeZone ?? 'utc',
        range: range.state,
        interval: '',
        intervalMs: 0,
        targets: [query],
        scopedVars: {},
        startTime: Date.now(),
      };

      return runRequest(dataSource, request);
    } catch (err) {
      this.setState({ error: err, state: LoadingState.Error });
      throw err;
    }
  }
}
