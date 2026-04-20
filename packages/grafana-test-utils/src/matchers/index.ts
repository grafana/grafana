import type { Observable } from 'rxjs';

import { toEmitValues } from './toEmitValues';
import { toEmitValuesWith } from './toEmitValuesWith';
import { toMatchCanvasSnapshot } from './toMatchCanvasSnapshot';
import { type ObservableMatchers } from './types';

export const matchers: ObservableMatchers<void, Observable<unknown>> = {
  toEmitValues,
  toEmitValuesWith,
  toMatchCanvasSnapshot,
};
