import { DataQuery, LoadingState } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { SceneObjectBase } from '../core/SceneObjectBase';

import { SceneVariable, SceneVariableState, VariableUpdateContext } from './types';

export interface QueryVariableState extends SceneVariableState {
  query: DataQuery;
}

export class QueryVariable extends SceneObjectBase<QueryVariableState> implements SceneVariable {
  async update(ctx: VariableUpdateContext) {
    const { query } = this.state;

    try {
      this.setState({ state: LoadingState.Loading });

      const datasource = await getDataSourceSrv().get(query.datasource);

      // We need to await the result from variableQueryRunner before moving on otherwise variables dependent on this
      // variable will have the wrong current value as input
      await new Promise((resolve, reject) => {
        const subscription: Subscription = new Subscription();
        const observer = variableQueryObserver(resolve, reject, subscription);
        const responseSubscription = getVariableQueryRunner().getResponse(identifier).subscribe(observer);
        subscription.add(responseSubscription);

        getVariableQueryRunner().queueRequest({ identifier, datasource, searchFilter });
      });
    } catch (err) {
      this.setState({ error: err, state: LoadingState.Error });
      throw err;
    }
  }
}
