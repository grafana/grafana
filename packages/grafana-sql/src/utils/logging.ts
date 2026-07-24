// eslint-disable-next-line @grafana/no-direct-create-monitoring-logger
import { createMonitoringLogger, type MonitoringLogger } from '@grafana/runtime';

export const sqlPluginLogger: MonitoringLogger = createMonitoringLogger('features.plugins.sql');
