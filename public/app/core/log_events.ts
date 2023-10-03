export enum PanelLogEvents {
  FIELD_CONFIG_OVERRIDES_CHANGED_EVENT = 'field config overrides changed',
  NEW_PANEL_OPTION_EVENT = 'new panel option',
  PANEL_OPTION_CHANGED_EVENT = 'panel option changed',
  NEW_DEFAULT_FIELD_CONFIG_EVENT = 'new default field config',
  DEFAULT_FIELD_CONFIG_CHANGED_EVENT = 'default field config changed',
  NEW_CUSTOM_FIELD_CONFIG_EVENT = 'new custom field config',
  CUSTOM_FIELD_CONFIG_CHANGED_EVENT = 'custom field config changed',
  MEASURE_PANEL_LOAD_TIME_EVENT = 'measure panel load time',
  PANEL_ERROR = 'panel error',
}

export const FIELD_CONFIG_CUSTOM_KEY = 'custom';
