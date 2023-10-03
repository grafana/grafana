import { useEffect, useRef } from 'react';

import { FieldConfigSource } from '@grafana/data';
import { faro } from '@grafana/faro-web-sdk';
import appEvents from 'app/core/app_events';
import { config } from 'app/core/config';
import { FIELD_CONFIG_CUSTOM_KEY, PanelLogEvents } from 'app/core/log_events';
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

  const logFieldConfigChanges = (
    fieldConfig: FieldConfigSource<unknown>,
    oldFieldConfig: FieldConfigSource<unknown>
  ) => {
    const oldDefaults: { [key: string]: unknown } = { ...oldFieldConfig.defaults };

    // go through field config keys except custom, we treat that below
    for (const [key, value] of Object.entries(fieldConfig.defaults)) {
      if (key === FIELD_CONFIG_CUSTOM_KEY) {
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
