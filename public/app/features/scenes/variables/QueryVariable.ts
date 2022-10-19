import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { CoreApp, DataQuery, DataQueryRequest, LoadingState, MetricFindValue, VariableOption } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { runRequest } from 'app/features/query/state/runRequest';

import { SceneObjectBase } from '../core/SceneObjectBase';

import { SceneVariable, SceneVariableState, VariableUpdateContext } from './types';

export interface QueryVariableState extends SceneVariableState {
  //query: DataQuery;
  query: string;
  options: VariableOption[];
}

export class QueryVariable extends SceneObjectBase<QueryVariableState> implements SceneVariable {
  update(ctx: VariableUpdateContext) {
    const { query } = this.state;
    //const range = this.getTimeRange();

    try {
      this.setState({ state: LoadingState.Loading });

      return new Observable<void>((observer) => {
        const timeout = setTimeout(() => {
          observer.complete();
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

function query(variable: QueryVariable): MetricFindValue[] {}
