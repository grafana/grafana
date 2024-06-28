// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/test/matchers/index.ts
import { Observable } from 'rxjs';

import { toEmitValues } from './toEmitValues';
import { toEmitValuesWith } from './toEmitValuesWith';
import { ObservableMatchers } from './types';

export const matchers: ObservableMatchers<void, Observable<any>> = {
  toEmitValues,
  toEmitValuesWith,
};
