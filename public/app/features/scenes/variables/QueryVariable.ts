import { Observable } from 'rxjs';

import { LoadingState, VariableOption } from '@grafana/data';
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
    //const range = this.getTimeRange();

    try {
      this.setState({ state: LoadingState.Loading });

      return new Observable<number>((observer) => {
        const timeout = setTimeout(() => {
          setDummyOptions(this, ctx);
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
  const options = result.map((x) => ({ text: x.name, value: x.name, selected: false }));
  variable.setState({
    options,
    value: options[0].value,
    text: options[0].text,
    state: LoadingState.Done,
  });
}
