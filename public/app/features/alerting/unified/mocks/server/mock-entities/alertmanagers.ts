import alertmanagerConfigMock from 'app/features/alerting/unified/components/contact-points/__mocks__/alertmanager.config.mock.json';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { AlertManagerCortexConfig, AlertmanagerStatus } from 'app/plugins/datasource/alertmanager/types';

//////////////////////////
// Alertmanager configs //
//////////////////////////

/** **INITIAL** state of alertmanager configs for different scenarios */
const ALERTMANAGER_CONFIGS: Record<string, AlertManagerCortexConfig> = {
  [GRAFANA_RULES_SOURCE_NAME]: alertmanagerConfigMock,
};

let ALERTMANAGER_CONFIG_MAP: Map<string, AlertManagerCortexConfig> = new Map(Object.entries(ALERTMANAGER_CONFIGS));

/** Setup/reset alertmanager configs for our mock server */
export const setupAlertmanagerConfigMapDefaultState = () => {
  ALERTMANAGER_CONFIG_MAP = new Map(Object.entries(ALERTMANAGER_CONFIGS));
};

/**
 * "Save" a new individual alertmanager config to our internal map
 */
export const setAlertmanagerConfig = (alertmanagerName: string, config: AlertManagerCortexConfig) => {
  ALERTMANAGER_CONFIG_MAP.set(alertmanagerName, config);
};

/**
 * Get alertmanager config from internal map, for use in assertions
 */
export const getAlertmanagerConfig = (alertmanagerName: string) => {
  return ALERTMANAGER_CONFIG_MAP.get(alertmanagerName)!;
};

///////////////////////////
// Alertmanager statuses //
///////////////////////////

/** **INITIAL** state of alertmanager configs for different scenarios */
const ALERTMANAGER_STATUSES: Record<string, AlertmanagerStatus> = {};

let ALERTMANAGER_STATUS_MAP: Map<string, AlertmanagerStatus> = new Map(Object.entries(ALERTMANAGER_STATUSES));

/** Setup/reset alertmanager statuses for our mock server */
export const setupAlertmanagerStatusMapDefaultState = () => {
  ALERTMANAGER_STATUS_MAP = new Map(Object.entries(ALERTMANAGER_STATUSES));
};

/**
 * "Save" a new individual alertmanager config to our internal map
 */
export const setAlertmanagerStatus = (alertmanagerName: string, config: AlertmanagerStatus) => {
  ALERTMANAGER_STATUS_MAP.set(alertmanagerName, config);
};

/**
 * Get alertmanager config from internal map, for use in assertions
 */
export const getAlertmanagerStatus = (alertmanagerName: string) => {
  return ALERTMANAGER_STATUS_MAP.get(alertmanagerName)!;
};
