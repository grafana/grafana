import React from 'react';
import { Observable, Subject } from 'rxjs';

import { queryMetricTree } from 'app/plugins/datasource/testdata/metricTree';

import { SceneComponentProps } from '../../core/types';
import { VariableDependencyConfig } from '../VariableDependencyConfig';
import { VariableValueSelect } from '../components/VariableValueSelect';
import { sceneTemplateInterpolator } from '../sceneTemplateInterpolator';
import { VariableValueOption } from '../types';

import { MultiValueVariable, MultiValueVariableState, VariableGetOptionsArgs } from './MultiValueVariable';

export interface TestVariableState extends MultiValueVariableState {
  query: string;
  delayMs?: number;
  issuedQuery?: string;
}

/**
 * This variable is only designed for unit tests and potentially e2e tests.
 */
export class TestVariable extends MultiValueVariable<TestVariableState> {
  private completeUpdate = new Subject<number>();
  public isGettingValues = true;

  protected _variableDependency = new VariableDependencyConfig(this, {
    statePaths: ['query'],
  });

  public getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]> {
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

      this.isGettingValues = true;

      return () => {
        clearTimeout(timeout);
        this.isGettingValues = false;
      };
    });
  }

  private issueQuery() {
    const interpolatedQuery = sceneTemplateInterpolator(this.state.query, this);
    const options = queryMetricTree(interpolatedQuery).map((x) => ({ label: x.name, value: x.name }));

    this.setState({
      issuedQuery: interpolatedQuery,
      options,
    });

    return options;
  }

  /** Useful from tests */
  public signalUpdateCompleted() {
    this.completeUpdate.next(1);
  }

  public static Component = ({ model }: SceneComponentProps<MultiValueVariable>) => {
    return <VariableValueSelect model={model} />;
  };
}
