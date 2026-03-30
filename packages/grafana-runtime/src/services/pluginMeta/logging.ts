import { type PluginType } from '@grafana/data';
import { type LogContext } from '@grafana/faro-web-sdk';

import { createMonitoringLogger, type MonitoringLogger } from '../../utils/logging';

const FALLBACK_TO_BOOTDATA_WARNING = `PluginMeta: plugin meta yielded an empty result so Grafana is falling back to bootdata`;

interface LogErrorArgs {
  type: PluginType;
}

let logger: MonitoringLogger;

function getLogger() {
  if (!logger) {
    logger = createMonitoringLogger('pluginMeta-logs');
  }

  return logger;
}

export function logWarning({ type }: LogErrorArgs): void {
  const context: LogContext = { type };

  getLogger().logWarning(FALLBACK_TO_BOOTDATA_WARNING, context);
  console.warn(FALLBACK_TO_BOOTDATA_WARNING);
}

export function setLogger(override: MonitoringLogger) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setLogger function can only be called from tests.');
  }

  logger = override;
}
