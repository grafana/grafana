import { Observable } from 'rxjs';

import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneVariable, SceneVariableState, VariableGetOptionsArgs, VariableValueOption } from '../types';

export abstract class SceneVariableBase<T extends SceneVariableState = SceneVariableState>
  extends SceneObjectBase<T>
  implements SceneVariable<T>
{
  abstract getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]>;

  updateValueGivenNewOptions(options: VariableValueOption[]) {
    if (options.length === 0) {
      // TODO handle the no value state
      this.setState({ value: '?' });
      return;
    }

    const foundCurrent = options.find((x) => x.value === this.state.value);
    if (!foundCurrent) {
      // Current value is not valid. Set to first of the available options
      this.setState({ value: options[0].value, text: options[0].label });
    }
  }
}
