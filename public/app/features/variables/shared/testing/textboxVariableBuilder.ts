import type { TextBoxVariableModel } from '@grafana/data/types';

import { OptionsVariableBuilder } from './optionsVariableBuilder';

export class TextBoxVariableBuilder<T extends TextBoxVariableModel> extends OptionsVariableBuilder<T> {
  withOriginalQuery(original: string) {
    this.variable.originalQuery = original;
    return this;
  }
}
