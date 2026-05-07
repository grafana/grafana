import {
  matchers as jestCanvasMatchers,
  type CustomSnapshotMatchers as CanvasSnapshotMatchers,
} from 'jest-canvas-mock-compare';
import type { Observable } from 'rxjs';

import { toEmitValues } from './toEmitValues';
import { toEmitValuesWith } from './toEmitValuesWith';
import { type ObservableMatchers } from './types';

export const matchers: ObservableMatchers<void, Observable<unknown>> | CanvasSnapshotMatchers = {
  toEmitValues,
  toEmitValuesWith,
  ...jestCanvasMatchers,
};
