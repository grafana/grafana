import { Observable } from 'rxjs';

import { toEmitValues } from './toEmitValues';
import { toEmitValuesWith } from './toEmitValuesWith';
import { ObservableMatchers } from './types';

export const matchers: ObservableMatchers<void, Observable<any>> = {
  toEmitValues,
  toEmitValuesWith,
};
