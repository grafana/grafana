import { useEffect, useRef } from 'react';

import { DataLink, FieldConfigSource, ThresholdsConfig, ValueMapping } from '@grafana/data';
import { faro } from '@grafana/faro-web-sdk';
import appEvents from 'app/core/app_events';
import { config } from 'app/core/config';
import {
  FIELD_CONFIG_CUSTOM_KEY,
  FIELD_CONFIG_DATA_LINKS_KEY,
  FIELD_CONFIG_MAPPINGS_KEY,
  FIELD_CONFIG_THRESHOLD_KEY,
  PanelLogEvents,
} from 'app/core/log_events';
import { DashboardSavedEvent } from 'app/types/events';

interface PanelOptionsLoggerProps {
  panelType: string;
  panelId: number;
  panelTitle: string;
  panelOptions: unknown;
  panelFieldConfig: FieldConfigSource;
}

export const usePanelOptionsLogger = (props: PanelOptionsLoggerProps) => {
  const panelIdStr = String(props.panelId);

  const oldPanelOptions = useRef(props.panelOptions);
  const oldPanelFieldConfig = useRef<FieldConfigSource>(props.panelFieldConfig);

  const savedPanelOptions = useRef(props.panelOptions);
  const savedFieldConfig = useRef<FieldConfigSource>(props.panelFieldConfig);

  const logChanges = () => {
    logPanelOptionChanges(savedPanelOptions.current, oldPanelOptions.current);
    logFieldConfigChanges(savedFieldConfig.current, oldPanelFieldConfig.current);

    //set the old values to the current values for next save
    oldPanelOptions.current = savedPanelOptions.current;
    oldPanelFieldConfig.current = savedFieldConfig.current;
  };

  useEffect(() => {
    savedPanelOptions.current = props.panelOptions;
  }, [props.panelOptions]);

  useEffect(() => {
    savedFieldConfig.current = props.panelFieldConfig;
  }, [props.panelFieldConfig]);

  const logPanelEvent = (eventName: string, newKey: string, newVal: string, oldVal?: string) => {
    const logObj = {
      key: newKey,
      newValue: newVal,
      oldValue: oldVal ?? '',
      panelTitle: props.panelTitle,
      panelId: panelIdStr,
      panelType: props.panelType,
    };

    console.log(eventName, logObj);
    return;
    faro.api.pushEvent(eventName, logObj);
  };

  const logPanelOptionChanges = (panelOptions: unknown, oldPanelOptions: unknown) => {
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
        logPanelEvent(PanelLogEvents.NEW_PANEL_OPTION_EVENT, key, newValue);
      } else if (oldValue !== newValue) {
        logPanelEvent(PanelLogEvents.PANEL_OPTION_CHANGED_EVENT, key, newValue, oldValue);
      }
    }
  };

  const logCustomFieldConfigChanges = (
    fieldConfig: FieldConfigSource<unknown>,
    oldDefaults: { [key: string]: unknown }
  ) => {
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
        logPanelEvent(PanelLogEvents.NEW_CUSTOM_FIELD_CONFIG_EVENT, key, newValue);
      } else if (oldValue !== newValue) {
        logPanelEvent(PanelLogEvents.CUSTOM_FIELD_CONFIG_CHANGED_EVENT, key, newValue, oldValue);
      }
    }
  };

  const logThresholdsChanges = (fieldConfig: FieldConfigSource<unknown>, oldThresholds?: ThresholdsConfig) => {
    if (!fieldConfig.defaults.thresholds || !oldThresholds) {
      return;
    }

    if (fieldConfig.defaults.thresholds.mode !== oldThresholds.mode) {
      logPanelEvent(
        PanelLogEvents.THRESHOLDS_MODE_CHANGED_EVENT,
        FIELD_CONFIG_THRESHOLD_KEY,
        fieldConfig.defaults.thresholds.mode,
        oldThresholds.mode
      );
    }

    if (fieldConfig.defaults.thresholds.steps.length !== oldThresholds.steps.length) {
      logPanelEvent(
        PanelLogEvents.THRESHOLDS_COUNT_CHANGED_EVENT,
        FIELD_CONFIG_THRESHOLD_KEY,
        String(fieldConfig.defaults.thresholds.steps.length),
        String(oldThresholds.steps.length)
      );
    }
  };

  const logMappingsChanges = (fieldConfig: FieldConfigSource<unknown>, oldMappings?: ValueMapping[]) => {
    if (!fieldConfig.defaults.mappings || !oldMappings) {
      return;
    }

    if (fieldConfig.defaults.mappings.length !== oldMappings.length) {
      logPanelEvent(
        PanelLogEvents.MAPPINGS_COUNT_CHANGED_EVENT,
        FIELD_CONFIG_MAPPINGS_KEY,
        String(fieldConfig.defaults.mappings.length),
        String(oldMappings.length)
      );
    }
  };

  const logDataLinksChanges = (fieldConfig: FieldConfigSource<unknown>, oldLinks?: DataLink[]) => {
    if (!fieldConfig.defaults.links || !oldLinks) {
      return;
    }

    if (fieldConfig.defaults.links.length !== oldLinks.length) {
      logPanelEvent(
        PanelLogEvents.LINKS_COUNT_CHANGED_EVENT,
        FIELD_CONFIG_DATA_LINKS_KEY,
        String(fieldConfig.defaults.links.length),
        String(oldLinks.length)
      );
    }
  };

  const logFieldConfigChanges = (
    fieldConfig: FieldConfigSource<unknown>,
    oldFieldConfig: FieldConfigSource<unknown>
  ) => {
    const oldDefaults: { [key: string]: unknown } = { ...oldFieldConfig.defaults };

    // go through field config keys except certain keys, we treat them below
    for (const [key, value] of Object.entries(fieldConfig.defaults)) {
      if (
        [
          FIELD_CONFIG_CUSTOM_KEY,
          FIELD_CONFIG_THRESHOLD_KEY,
          FIELD_CONFIG_MAPPINGS_KEY,
          FIELD_CONFIG_DATA_LINKS_KEY,
        ].includes(key)
      ) {
        continue;
      }

      const newValue: string = typeof value !== 'string' ? JSON.stringify(value) : value;
      const oldValue: string = typeof value !== 'string' ? JSON.stringify(oldDefaults[key]) : String(oldDefaults[key]);

      if (oldDefaults[key] === undefined) {
        logPanelEvent(PanelLogEvents.NEW_DEFAULT_FIELD_CONFIG_EVENT, key, newValue);
      } else if (oldValue !== newValue) {
        logPanelEvent(PanelLogEvents.DEFAULT_FIELD_CONFIG_CHANGED_EVENT, key, newValue, oldValue);
      }
    }

    logCustomFieldConfigChanges(fieldConfig, oldDefaults);
    logThresholdsChanges(fieldConfig, oldFieldConfig.defaults.thresholds);
    logMappingsChanges(fieldConfig, oldFieldConfig.defaults.mappings);
    logDataLinksChanges(fieldConfig, oldFieldConfig.defaults.links);
  };

  useEffect(() => {
    if (!config.grafanaJavascriptAgent.enabled || !config.featureToggles.panelMonitoring) {
      return;
    }

    const sub = appEvents.subscribe(DashboardSavedEvent, logChanges);

    return () => {
      //exiting panel edit mode or changing panel type will auto log changes and unsub
      logChanges();
      sub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};
