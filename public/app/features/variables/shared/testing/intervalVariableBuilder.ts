import { IntervalVariableModel, VariableRefresh } from '@grafana/data';

import { OptionsVariableBuilder } from './optionsVariableBuilder';

export class IntervalVariableBuilder extends OptionsVariableBuilder<IntervalVariableModel> {
  withRefresh(refresh: VariableRefresh) {
    this.variable.refresh = refresh;
    return this;
  }

  withAuto(auto: boolean) {
    this.variable.auto = auto;
    return this;
  }

  withAutoCount(autoCount: number) {
    this.variable.auto_count = autoCount;
    return this;
  }

  withAutoMin(autoMin: string) {
    this.variable.auto_min = autoMin;
    return this;
  }
}
