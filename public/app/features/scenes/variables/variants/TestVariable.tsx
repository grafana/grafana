import React from 'react';
import { Observable, Subject } from 'rxjs';

import { queryMetricTree } from 'app/plugins/datasource/testdata/metricTree';

import { SceneComponentProps } from '../../core/types';
import { VariableValueSelect } from '../components/VariableValueSelect';
import { getVariableDependencies } from '../getVariableDependencies';
import { sceneTemplateInterpolator } from '../sceneTemplateInterpolator';
import { VariableValueOption } from '../types';

import { MultiValueVariable, MultiValueVariableState, VariableGetOptionsArgs } from './MultiValueVariable';

export interface TestVariableState extends MultiValueVariableState {
  //query: DataQuery;
  query: string;
  delayMs?: number;
  issuedQuery?: string;
}

/**
 * This variable is only designed for unit tests and potentially e2e tests.
 */
export class TestVariable extends MultiValueVariable<TestVariableState> {
  completeUpdate = new Subject<number>();

  getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]> {
    const { delayMs } = this.state;

    return new Observable<VariableValueOption[]>((observer) => {
      this.setState({ loading: true });

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
      options,
    });

    return options;
  }

  /** Useful from tests */
  signalUpdateCompleted() {
    this.completeUpdate.next(1);
  }

  getDependencies() {
    return getVariableDependencies(this.state.query);
  }

  static Component = ({ model }: SceneComponentProps<MultiValueVariable>) => {
    return <VariableValueSelect model={model} />;
  };
}
