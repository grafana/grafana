export enum PanelLogEvents {
  FIELD_CONFIG_OVERRIDES_CHANGED_EVENT = 'field config overrides changed',
  NEW_PANEL_OPTION_EVENT = 'new panel option',
  PANEL_OPTION_CHANGED_EVENT = 'panel option changed',
  NEW_DEFAULT_FIELD_CONFIG_EVENT = 'new default field config',
  DEFAULT_FIELD_CONFIG_CHANGED_EVENT = 'default field config changed',
  NEW_CUSTOM_FIELD_CONFIG_EVENT = 'new custom field config',
  CUSTOM_FIELD_CONFIG_CHANGED_EVENT = 'custom field config changed',
  MEASURE_PANEL_LOAD_TIME_EVENT = 'measure panel load time',
  THRESHOLDS_COUNT_CHANGED_EVENT = 'thresholds count changed',
  THRESHOLDS_MODE_CHANGED_EVENT = 'thresholds mode changed',
  MAPPINGS_COUNT_CHANGED_EVENT = 'mappings count changed',
  LINKS_COUNT_CHANGED_EVENT = 'links count changed',
  PANEL_ERROR = 'panel error',
}

export const FIELD_CONFIG_OVERRIDES_KEY = 'overrides';
export const FIELD_CONFIG_CUSTOM_KEY = 'custom';
