import { VariableOption, VariableWithOptions } from 'app/features/templating/types';
import { VariableBuilder } from './variableBuilder';

export class OptionsVariableBuilder<T extends VariableWithOptions> extends VariableBuilder<T> {
  withOptions(...texts: string[]) {
    this.variable.options = [];
    for (let index = 0; index < texts.length; index++) {
      this.variable.options.push({
        text: texts[index],
        value: texts[index],
        selected: false,
      });
    }
    return this;
  }

  withoutOptions() {
    this.variable.options = (undefined as unknown) as VariableOption[];
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

  withQuery(query: string) {
    this.variable.query = query;
    return this;
  }
}
