import { delay, Observable, of } from 'rxjs';

import { LoadingState, VariableOption } from '@grafana/data';
import { queryMetricTree } from 'app/plugins/datasource/testdata/metricTree';

import { SceneObjectBase } from '../core/SceneObjectBase';

import { VariableValueSelect } from './components/VariableValueSelect';
import { getVariableDependencies } from './getVariableDependencies';
import { sceneTemplateInterpolator } from './sceneTemplateInterpolator';
import { SceneVariable, SceneVariableState, VariableUpdateContext } from './types';

export interface TestVariableState extends SceneVariableState {
  //query: DataQuery;
  query: string;
  options: VariableOption[];
  delayMs?: number;
  completeUpdate?: Observable<number>;
}

export class TestVariable extends SceneObjectBase<TestVariableState> implements SceneVariable {
  ValueSelectComponent = VariableValueSelect;

  updateOptions(ctx: VariableUpdateContext) {
    const { delayMs = 0, completeUpdate } = this.state;

    try {
      this.setState({ state: LoadingState.Loading });

      let obs = new Observable<number>((observer) => {
        if (completeUpdate) {
          completeUpdate.subscribe({
            next: () => {
              setDummyOptions(this, ctx);
              observer.next(1);
            },
          });
        } else {
          setDummyOptions(this, ctx);
          observer.next(1);
        }

        return () => {
          console.log('Canceling QueryVariable query');
        };
      });

      if (delayMs) {
        obs = obs.pipe(delay(delayMs));
      }

      return obs;
    } catch (err) {
      this.setState({ error: err, state: LoadingState.Error });
      throw err;
    }
  }

  getDependencies() {
    return getVariableDependencies(this.state.query);
  }
}

function setDummyOptions(variable: TestVariable, ctx: VariableUpdateContext) {
  const interpolatedQuery = sceneTemplateInterpolator(variable.state.query, ctx.sceneContext);
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
