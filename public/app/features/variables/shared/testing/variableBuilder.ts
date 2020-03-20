import cloneDeep from 'lodash/cloneDeep';
import { VariableModel } from 'app/features/templating/variable';

export class VariableBuilder<T extends VariableModel> {
  protected variable: T;

  constructor(initialState: T) {
    const { uuid, index, global, ...rest } = initialState;
    this.variable = cloneDeep({ ...rest, name: rest.type }) as T;
  }

  withName(name: string) {
    this.variable.name = name;
    return this;
  }

  withUUID(uuid: string) {
    this.variable.uuid = uuid;
    return this;
  }

  build(): T {
    return this.variable;
  }
}
