import { VariableWithMultiSupport } from 'app/features/variables/types';

import { OptionsVariableBuilder } from './optionsVariableBuilder';

export class MultiVariableBuilder<T extends VariableWithMultiSupport> extends OptionsVariableBuilder<T> {
  withMulti(multi = true) {
    this.variable.multi = multi;
    return this;
  }
  withIncludeAll(includeAll = true) {
    this.variable.includeAll = includeAll;
    return this;
  }
  withAllValue(allValue: string) {
    this.variable.allValue = allValue;
    return this;
  }
}
