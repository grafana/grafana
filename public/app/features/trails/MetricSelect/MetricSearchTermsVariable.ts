import { VariableHide } from '@grafana/data';
import {
  SceneVariable,
  SceneObjectBase,
  VariableValue,
  SceneVariableState,
  SceneVariableValueChangedEvent,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneObjectWithUrlSync,
  sceneGraph,
  AdHocFiltersVariable,
} from '@grafana/scenes';

import { VAR_FILTERS, VAR_METRIC_SEARCH_TERMS } from '../shared';

import { createPromRegExp } from './util';

export interface MetricsSearchTermsVariableState extends SceneVariableState {
  terms: string[];
}

export class MetricSearchTermsVariable
  extends SceneObjectBase<MetricsSearchTermsVariableState>
  implements SceneVariable<MetricsSearchTermsVariableState>, SceneObjectWithUrlSync
{
  constructor(state: Partial<MetricsSearchTermsVariableState> = {}) {
    super({
      type: 'constant',
      name: VAR_METRIC_SEARCH_TERMS,
      label: 'Metrics search',
      hide: VariableHide.hideVariable,
      skipUrlSync: false,
      terms: [],
      ...state,
    });
  }

  updateTerms(terms: string[]) {
    this.setState({ terms });
    this.publishEvent(new SceneVariableValueChangedEvent(this), true);
  }

  getValue(): VariableValue {
    const filtersVar = sceneGraph.lookupVariable(VAR_FILTERS, this);

    let comma = ',';

    if (filtersVar instanceof AdHocFiltersVariable) {
      const value = filtersVar.getValue()?.valueOf();
      if (!value) {
        comma = '';
      }
    }

    return {
      formatter: (format: Format) => {
        const { terms } = this.state;

        switch (format) {
          case 'filter': {
            const regex = createPromRegExp(terms);
            const result = !terms?.length ? '' : `${comma}__name__=~"${regex}"`;
            return result;
          }
          default:
            return terms.join(',');
        }
      },
    };
  }

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: [`var-${this.state.name}`] });

  getUrlState(): SceneObjectUrlValues {
    const urlState = { [`var-${this.state.name}`]: this.state.terms.join(',') };
    return urlState;
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const termsCsv = values[`var-${this.state.name}`];
    if (typeof termsCsv === 'string') {
      const terms = termsCsv.split(',');
      this.setState({ terms });
    }
  }
}

type Format = 'filter' | 'csvlist';
