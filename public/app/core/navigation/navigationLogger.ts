import { locationService } from '@grafana/runtime';
import { attachDebugger, createLogger } from '@grafana/ui';

const navigationLog = createLogger('Router');

export const navigationLogger = navigationLog.logger;

// For debugging purposes the location service is attached to global _debug variable
attachDebugger('location', locationService, navigationLog);
