import { Observable, Subject } from 'rxjs';

import { LoadingState, SelectableValue, VariableOption } from '@grafana/data';
import { queryMetricTree } from 'app/plugins/datasource/testdata/metricTree';

import { VariableValueSelect } from '../components/VariableValueSelect';
import { getVariableDependencies } from '../getVariableDependencies';
import { sceneTemplateInterpolator } from '../sceneTemplateInterpolator';
import { SceneVariableState, VariableGetOptionsArgs, VariableValueOption } from '../types';

import { SceneVariableBase } from './SceneVariableBase';

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

  getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]> {
    const { delayMs } = this.state;

    return new Observable<VariableValueOption[]>((observer) => {
      this.setState({ state: LoadingState.Loading });

      this.completeUpdate.subscribe({
        next: () => {
          observer.next(this.issueQuery());
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
  }

  issueQuery() {
    const interpolatedQuery = sceneTemplateInterpolator(this.state.query, this);
    const options = queryMetricTree(interpolatedQuery).map((x) => ({ label: x.name, value: x.name }));

    this.setState({
      issuedQuery: interpolatedQuery,
    });

    return options;
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
