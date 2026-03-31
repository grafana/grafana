import { type PluginType } from '@grafana/data';
import { type LogContext } from '@grafana/faro-web-sdk';

import { createMonitoringLogger, type MonitoringLogger } from '../../utils/logging';

let logger: MonitoringLogger;

function getLogger() {
  if (!logger) {
    logger = createMonitoringLogger('pluginMeta-logs');
  }

  return logger;
}

export function logWarning(message: string, type: PluginType): void {
  const context: LogContext = { type };

  getLogger().logWarning(message, context);
  console.warn(message);
}

export function setLogger(override: MonitoringLogger) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setLogger function can only be called from tests.');
  }

  logger = override;
}
