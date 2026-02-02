import { QueryVariable, VariableValueOption } from '@grafana/scenes';
import { getFeatureStatus } from 'app/features/dashboard/services/featureFlagSrv';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import { QueryVariableBMCRenderer } from './QueryVariableBMCRenderer';

export class QueryVariableBMC extends QueryVariable {
  static description = 'BMC Helix Query Variable';

  static Component = QueryVariableBMCRenderer;

  constructor(props: any) {
    super({
      ...props,
      noValueOnClear: getFeatureStatus('bhd_disable_default_variable_selection') ? true : false,
    });
  }

  public getDefaultMultiState(options: VariableValueOption[]) {
    if (!getFeatureStatus('bhd_disable_default_variable_selection')) {
      if (this.state.defaultToAll) {
        return { value: [ALL_VARIABLE_VALUE], text: [ALL_VARIABLE_TEXT] };
      } else if (options.length > 0) {
        return { value: [options[0].value], text: [options[0].label] };
      } else {
        return { value: [], text: [] };
      }
    } else {
      return { value: [], text: [] };
    }
  }
}
