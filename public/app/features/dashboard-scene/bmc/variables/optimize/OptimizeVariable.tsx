import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneVariable,
  SceneVariableState,
  SceneVariableValueChangedEvent,
  VariableValue,
} from '@grafana/scenes';

import { OptimizeVariableInput } from './OptimizeVariableInput';

export interface OptimizeVariableState extends SceneVariableState {
  value: string[];
  filterondescendant: boolean;
}

export class OptimizeVariable
  extends SceneObjectBase<OptimizeVariableState>
  implements SceneVariable<OptimizeVariableState>
{
  public constructor(initialState: Partial<OptimizeVariableState>) {
    super({
      type: 'optimizepicker',
      value: [],
      name: '',
      filterondescendant: false,
      ...initialState,
    });
    this._urlSync = new SceneObjectUrlSyncConfig(this, { keys: () => [this.getKey()] });
  }

  public getValue(): VariableValue {
    return this.state.value;
  }

  public setValue(newValue: string[]) {
    if (JSON.stringify(newValue) !== JSON.stringify(this.state.value)) {
      this.setState({ value: newValue });
      this.publishEvent(new SceneVariableValueChangedEvent(this), true);
    }
  }

  private getKey(): string {
    return `var-${this.state.name}`;
  }

  public getUrlState() {
    return { [this.getKey()]: this.state.value };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    const val = values[this.getKey()];
    if (val !== null) {
      if (Array.isArray(val)) {
        this.setValue(val);
      } else {
        this.setValue([val!]);
      }
    }
  }

  public static Component = ({ model }: SceneComponentProps<OptimizeVariable>) => {
    return <OptimizeVariableInput model={model} />;
  };
}
