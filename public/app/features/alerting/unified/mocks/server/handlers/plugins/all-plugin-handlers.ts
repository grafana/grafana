/**
 * Re-exports all plugin proxy handlers
 */
import labelsHandlers from './grafana-labels-app';
import onCallHandlers from './grafana-oncall';

/**
 * Array of all plugin handlers that are required across Alerting tests
 */
const allPluginProxyHandlers = [...onCallHandlers, ...labelsHandlers];

export default allPluginProxyHandlers;
