import { FieldConfigSource } from '@grafana/data';
import { faro } from '@grafana/faro-web-sdk';
import { FIELD_CONFIG_CUSTOM_KEY, FIELD_CONFIG_OVERRIDES_KEY, PanelLogEvents } from 'app/core/log_events';

interface PanelLogInfo {
  panelId: string;
  panelType: string;
  panelTitle: string;
}

export class PanelOptionsLogger {
  private initialPanelOptions: unknown;
  private initialFieldConfig: FieldConfigSource;
  private panelLogInfo: PanelLogInfo;

  constructor(initialPanelOptions: unknown, initialFieldConfig: FieldConfigSource, panelLogInfo: PanelLogInfo) {
    this.initialPanelOptions = initialPanelOptions;
    this.initialFieldConfig = initialFieldConfig;
    this.panelLogInfo = panelLogInfo;
  }

  logChanges = (latestPanelOptions: unknown, latestFieldConfig: FieldConfigSource) => {
    this.logPanelOptionChanges(latestPanelOptions, this.initialPanelOptions);
    this.logFieldConfigChanges(latestFieldConfig, this.initialFieldConfig);

    //set the old values to the current values for next log diff
    this.initialPanelOptions = latestPanelOptions;
    this.initialFieldConfig = latestFieldConfig;
  };

  logPanelEvent = (eventName: string, newKey: string, newVal: string, oldVal?: string) => {
    const logObj = {
      key: newKey,
      newValue: newVal,
      oldValue: oldVal ?? '',
      panelTitle: this.panelLogInfo.panelTitle,
      panelId: this.panelLogInfo.panelId,
      panelType: this.panelLogInfo.panelType,
    };

    faro.api.pushEvent(eventName, logObj);
  };

  logPanelOptionChanges = (panelOptions: unknown, oldPanelOptions: unknown) => {
    if (typeof panelOptions !== 'object' || panelOptions === null) {
      return;
    }

    if (typeof oldPanelOptions !== 'object' || oldPanelOptions === null) {
      return;
    }

    const oldPanelOptionsUnknown: { [key: string]: unknown } = { ...oldPanelOptions };

    for (const [key, value] of Object.entries(panelOptions)) {
      const newValue: string = typeof value !== 'string' ? JSON.stringify(value) : value;
      const oldValue: string =
        typeof value !== 'string' ? JSON.stringify(oldPanelOptionsUnknown[key]) : String(oldPanelOptionsUnknown[key]);

      if (oldPanelOptionsUnknown[key] === undefined) {
        this.logPanelEvent(PanelLogEvents.NEW_PANEL_OPTION_EVENT, key, newValue);
      } else if (oldValue !== newValue) {
        this.logPanelEvent(PanelLogEvents.PANEL_OPTION_CHANGED_EVENT, key, newValue, oldValue);
      }
    }
  };

  logFieldConfigChanges = (fieldConfig: FieldConfigSource<unknown>, oldFieldConfig: FieldConfigSource<unknown>) => {
    // overrides are an array of objects, so stringify it all and log changes
    // in lack of an index, we can't tell which override changed
    const oldOverridesStr = JSON.stringify(oldFieldConfig.overrides);
    const newOverridesStr = JSON.stringify(fieldConfig.overrides);
    if (oldOverridesStr !== newOverridesStr) {
      this.logPanelEvent(
        PanelLogEvents.FIELD_CONFIG_OVERRIDES_CHANGED_EVENT,
        FIELD_CONFIG_OVERRIDES_KEY,
        newOverridesStr,
        oldOverridesStr
      );
    }

    const oldDefaults: { [key: string]: unknown } = { ...oldFieldConfig.defaults };

    // go through field config keys except custom, we treat that below
    for (const [key, value] of Object.entries(fieldConfig.defaults)) {
      if (key === FIELD_CONFIG_CUSTOM_KEY) {
        continue;
      }

      const newValue: string = typeof value !== 'string' ? JSON.stringify(value) : value;
      const oldValue: string = typeof value !== 'string' ? JSON.stringify(oldDefaults[key]) : String(oldDefaults[key]);

      if (oldDefaults[key] === undefined) {
        this.logPanelEvent(PanelLogEvents.NEW_DEFAULT_FIELD_CONFIG_EVENT, key, newValue);
      } else if (oldValue !== newValue) {
        this.logPanelEvent(PanelLogEvents.DEFAULT_FIELD_CONFIG_CHANGED_EVENT, key, newValue, oldValue);
      }
    }

    if (!fieldConfig.defaults.custom || oldDefaults.custom === undefined) {
      return;
    }

    const oldCustom: { [key: string]: unknown } = { ...oldDefaults.custom };

    // go through custom field config keys
    for (const [key, value] of Object.entries(fieldConfig.defaults.custom)) {
      if (oldDefaults.custom === null || oldCustom[key] === null) {
        continue;
      }

      const newValue: string = typeof value !== 'string' ? JSON.stringify(value) : value;
      const oldValue: string = typeof value !== 'string' ? JSON.stringify(oldCustom[key]) : String(oldCustom[key]);

      if (oldCustom[key] === undefined) {
        this.logPanelEvent(PanelLogEvents.NEW_CUSTOM_FIELD_CONFIG_EVENT, key, newValue);
      } else if (oldValue !== newValue) {
        this.logPanelEvent(PanelLogEvents.CUSTOM_FIELD_CONFIG_CHANGED_EVENT, key, newValue, oldValue);
      }
    }
  };
}
