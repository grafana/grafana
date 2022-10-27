import { Observable, Subject } from 'rxjs';

import { LoadingState, SelectableValue, VariableOption } from '@grafana/data';
import { queryMetricTree } from 'app/plugins/datasource/testdata/metricTree';

import { SceneVariableBase } from '../SceneVariableBase';
import { VariableValueSelect } from '../components/VariableValueSelect';
import { getVariableDependencies } from '../getVariableDependencies';
import { sceneTemplateInterpolator } from '../sceneTemplateInterpolator';
import { SceneVariableState, VariableUpdateContext } from '../types';

export interface TestVariableState extends SceneVariableState {
  //query: DataQuery;
  query: string;
  options: VariableOption[];
  delayMs?: number;
  issuedQuery?: string;
}

/**
 * This variable is only designed for unit tests and potentially e2e tests.
 */
export class TestVariable extends SceneVariableBase<TestVariableState> {
  ValueSelectComponent = VariableValueSelect;
  completeUpdate = new Subject<number>();

  updateOptions(ctx: VariableUpdateContext) {
    const { delayMs } = this.state;

    try {
      this.setState({ state: LoadingState.Loading });

      return new Observable<number>((observer) => {
        this.completeUpdate.subscribe({
          next: () => {
            setDummyOptions(this, ctx);
            observer.next(1);
          },
        });

        let timeout: NodeJS.Timeout | undefined;

        if (delayMs) {
          timeout = setTimeout(() => this.signalUpdateCompleted(), delayMs);
        }

        return () => {
          clearTimeout(timeout);
          // console.log('Canceling QueryVariable query');
        };
      });
    } catch (err) {
      this.setState({ error: err, state: LoadingState.Error });
      throw err;
    }
  }

  onValueChange = (value: SelectableValue<string>) => {
    this.setState({ value: value.value });
  };

  /** Useful from tests */
  signalUpdateCompleted() {
    this.completeUpdate.next(1);
  }

  getDependencies() {
    return getVariableDependencies(this.state.query);
  }
}

function setDummyOptions(variable: TestVariable, ctx: VariableUpdateContext) {
  const interpolatedQuery = sceneTemplateInterpolator(variable.state.query, ctx.sceneContext);
  const options = queryMetricTree(interpolatedQuery).map((x) => ({ text: x.name, value: x.name, selected: false }));

  variable.setState({
    issuedQuery: interpolatedQuery,
    options,
    value: options.length > 0 ? options[0].value : '',
    text: options.length > 0 ? options[0].text : '',
    state: LoadingState.Done,
  });
}
