// This is empty for now, as I think it's not going to be necessary.
// This replaces Angular RouteProvider implementation with a dummy one to keep the ball rolling

import { frontendLogging } from '@grafana/data';

export class RouteProvider {
  constructor() {
    frontendLogging.getLogger('navigation').debug('Patch angular', false, 'RouteProvider');
  }

  $get() {
    return this;
  }
}
