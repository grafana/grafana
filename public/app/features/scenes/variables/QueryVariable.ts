import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { CoreApp, DataQuery, DataQueryRequest, LoadingState, MetricFindValue, VariableOption } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { runRequest } from 'app/features/query/state/runRequest';
import { queryMetricTree } from 'app/plugins/datasource/testdata/metricTree';

import { SceneObjectBase } from '../core/SceneObjectBase';

import { sceneTemplateInterpolator } from './SceneVariableSet';
import { SceneVariable, SceneVariableState, VariableUpdateContext } from './types';

export interface QueryVariableState extends SceneVariableState {
  //query: DataQuery;
  query: string;
  options: VariableOption[];
}

export class QueryVariable extends SceneObjectBase<QueryVariableState> implements SceneVariable {
  updateOptions(ctx: VariableUpdateContext) {
    const { query } = this.state;
    //const range = this.getTimeRange();

    try {
      this.setState({ state: LoadingState.Loading });

      return new Observable<number>((observer) => {
        const timeout = setTimeout(() => {
          setDummyOptions(variable, ctx);
        }, 1000);

        return () => {
          clearTimeout(timeout);
          console.log('Canceling QueryVariable query');
        };
      });
    } catch (err) {
      this.setState({ error: err, state: LoadingState.Error });
      throw err;
    }
  }
}

function setDummyOptions(variable: QueryVariable, ctx: VariableUpdateContext) {
  const interpolatedQuery = sceneTemplateInterpolator(variable.state.query, ctx.sceneLocation);
  console.log('interpolated query', interpolatedQuery);
  const result = queryMetricTree(interpolatedQuery);
}
