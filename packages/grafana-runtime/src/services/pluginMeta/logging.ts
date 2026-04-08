import { type PluginType } from '@grafana/data';

import { createMonitoringLogger, type MonitoringLogger } from '../../utils/logging';

let logger: MonitoringLogger;

function getLogger() {
  if (!logger) {
    logger = createMonitoringLogger('pluginMeta-logs');
  }

  return logger;
}

export function logPluginMetaWarning(message: string, type: PluginType): void {
  getLogger().logWarning(message, { type });
  console.warn(message);
}

export function logPluginMetaError(message: string, error: unknown): void {
  getLogger().logError(new Error(message, { cause: error }));
  console.error(message, error);
}

export function setPluginMetaLogger(override: MonitoringLogger) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setLogger function can only be called from tests.');
  }

  logger = override;
}
