import { VariableOption, VariableWithOptions } from 'app/features/variables/types';

import { VariableBuilder } from './variableBuilder';

export class OptionsVariableBuilder<T extends VariableWithOptions> extends VariableBuilder<T> {
  withOptions(...options: Array<string | { text: string; value: string }>) {
    this.variable.options = [];
    for (let index = 0; index < options.length; index++) {
      const option = options[index];

      if (typeof option === 'string') {
        this.variable.options.push({
          text: option,
          value: option,
          selected: false,
        });
      } else {
        this.variable.options.push({ ...option, selected: false });
      }
    }
    return this;
  }

  withoutOptions() {
    this.variable.options = undefined as unknown as VariableOption[];
    return this;
  }

  withCurrent(text: string | string[], value?: string | string[]) {
    this.variable.current = {
      text,
      value: value ?? text,
      selected: true,
    };
    return this;
  }

  withQuery(query: any) {
    this.variable.query = query;
    return this;
  }
}
