/**
 * Re-exports all plugin proxy handlers
 */
import onCallHandlers from './grafana-oncall';

/**
 * Array of all plugin handlers that are required across Alerting tests
 */
const allPluginProxyHandlers = [...onCallHandlers];

export default allPluginProxyHandlers;
