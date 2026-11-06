import type { CustomSnapshotMatchers as CanvasSnapshotMatchers } from 'jest-canvas-mock-compare';
import type { Observable } from 'rxjs';

import { type ObservableMatchers } from './types';

// Register matchers in every suite without loading implementations that the suite never calls.
export const matchers: ObservableMatchers<void, Observable<unknown>> | CanvasSnapshotMatchers = {
  toEmitValues<T>(received: Observable<T>, expected: T[]) {
    const { toEmitValues } = require('./toEmitValues') as typeof import('./toEmitValues');
    return toEmitValues(received, expected);
  },
  toEmitValuesWith<T>(received: Observable<T>, expectations: (received: T[]) => void) {
    const { toEmitValuesWith } = require('./toEmitValuesWith') as typeof import('./toEmitValuesWith');
    return toEmitValuesWith(received, expectations);
  },
  toMatchCanvasSnapshot(this: jest.MatcherContext, ...args: Parameters<CanvasSnapshotMatchers['toMatchCanvasSnapshot']>) {
    // Non-canvas suites must not load the canvas comparator's separate snapshot dependency graph.
    const { matchers } = require('jest-canvas-mock-compare') as typeof import('jest-canvas-mock-compare');
    return matchers.toMatchCanvasSnapshot.apply(this, args);
  },
};
