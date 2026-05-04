import type { Observable } from 'rxjs';

import { toEmitValues } from './toEmitValues';
import { toEmitValuesWith } from './toEmitValuesWith';
import { toMatchCanvasSnapshot } from './toMatchCanvasSnapshot';
import { type CustomSnapshotMatchers, type ObservableMatchers } from './types';

export const matchers: ObservableMatchers<void, Observable<unknown>> | CustomSnapshotMatchers = {
  toEmitValues,
  toEmitValuesWith,
  toMatchCanvasSnapshot,
};
