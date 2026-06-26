// This is empty for now, as I think it's not going to be necessary.
// This replaces Angular RouteProvider implementation with a dummy one to keep the ball rolling

import { navigationLogger } from '@grafana/runtime';

export class RouteProvider {
  constructor() {
    navigationLogger('Patch angular', false, 'RouteProvider');
  }

  $get() {
    return this;
  }
}
