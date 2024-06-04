import { VariableHide } from '@grafana/data';
import { VariableValue, SceneVariableState, sceneGraph, AdHocFiltersVariable, TextBoxVariable } from '@grafana/scenes';

import { VAR_FILTERS, VAR_METRIC_SEARCH_TERMS } from '../shared';

import { createPromRegExp, deriveSearchTermsFromInput } from './util';

export interface MetricsSearchTermsVariableState extends SceneVariableState {
  terms: string[];
}

export class MetricSearchTermsVariable extends TextBoxVariable {
  constructor(initialState: Partial<{ value: string }>) {
    super({
      value: '',
      hide: VariableHide.hideVariable,
      name: VAR_METRIC_SEARCH_TERMS,
      ...initialState,
    });
  }

  getValue(): VariableValue {
    const filtersVar = sceneGraph.lookupVariable(VAR_FILTERS, this);

    const { value } = this.state;
    let separator = ',';

    if (filtersVar instanceof AdHocFiltersVariable) {
      const value = filtersVar.getValue()?.valueOf();
      if (!value) {
        separator = '';
      }
    }

    return {
      formatter: (format: Format) => {
        switch (format) {
          case 'filter': {
            const terms = deriveSearchTermsFromInput(value);
            const regex = createPromRegExp(terms);
            const result = !terms?.length ? '' : `${separator}__name__=~"${regex}"`;
            return result;
          }
          default:
            return value;
        }
      },
    };
  }
}

type Format = 'filter' | 'csvlist';
