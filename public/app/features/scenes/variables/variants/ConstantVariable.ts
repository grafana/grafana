import { Observable, of } from 'rxjs';

import { VariableGetOptionsArgs, VariableValueOption } from '../types';

import { SceneVariableBase } from './SceneVariableBase';

/**
 * This variable is only designed for unit tests and potentially e2e tests.
 */
export class ConstantVariable extends SceneVariableBase {
  getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]> {
    // todo
    return of([]);
  }
}
