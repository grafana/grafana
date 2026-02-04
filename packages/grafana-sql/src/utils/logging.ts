import { createMonitoringLogger, MonitoringLogger } from '@grafana/runtime';

export const sqlPluginLogger: MonitoringLogger = createMonitoringLogger('features.plugins.sql');
