import { useEffect, useRef } from 'react';

import { FieldConfigSource, TimeRange } from '@grafana/data';
import { faro } from '@grafana/faro-web-sdk';
import appEvents from 'app/core/app_events';
import { DashboardSavedEvent } from 'app/types/events';

interface Props {
  children: JSX.Element;
  isInPanelEdit: boolean;
  panelType: string;
  panelId: number;
  panelTitle: string;
  panelOptions: any;
  panelFieldConfig: FieldConfigSource;
  timeRange: TimeRange;
}

export const PanelPerformanceMonitor = (props: Props) => {
  const startLoadTime = performance.now();
  const panelIdStr = String(props.panelId);

  const oldPanelOptions = useRef(props.panelOptions);
  const oldPanelFieldConfig = useRef<FieldConfigSource>(props.panelFieldConfig);

  const savedFieldConfig = useRef<FieldConfigSource>(props.panelFieldConfig);
  const savedPanelOptions = useRef(props.panelOptions);

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

  const logEvent = (eventName: string, newKey: string, newVal: string, oldVal?: string) => {
    const logObj = {
      key: newKey,
      newValue: newVal,
      oldValue: oldVal ?? '',
      panelTitle: props.panelTitle,
      panelId: panelIdStr,
      panelType: props.panelType,
    };

    //TODO: do batch push when that becomes available
    faro.api.pushEvent(eventName, logObj);
  };

  const logPanelOptionChanges = (panelOptions: any, oldPanelOptions: any) => {
    for (const [key, value] of Object.entries(panelOptions)) {
      const newValue: string = typeof value !== 'string' ? JSON.stringify(value) : value;
      const oldValue: string = typeof value !== 'string' ? JSON.stringify(oldPanelOptions[key]) : oldPanelOptions[key];

      if (oldPanelOptions[key] === undefined) {
        logEvent('new panel option', key, newValue);
      } else if (oldValue !== newValue) {
        logEvent('panel option changed', key, newValue, oldValue);
      }
    }
  };

  const logFieldConfigChanges = (fieldConfig: FieldConfigSource, oldFieldConfig: FieldConfigSource) => {
    const oldDefaults: { [key: string]: any } = oldFieldConfig.defaults;

    // go through field config keys except custom, we treat that below
    for (const [key, value] of Object.entries(fieldConfig.defaults)) {
      if (key === 'custom') {
        continue;
      }

      const newValue: string = typeof value !== 'string' ? JSON.stringify(value) : value;
      const oldValue: string = typeof value !== 'string' ? JSON.stringify(oldDefaults[key]) : oldDefaults[key];

      if (oldDefaults[key] === undefined) {
        logEvent('new field config', key, newValue);
      } else if (oldValue !== newValue) {
        logEvent('field config changed', key, newValue, oldValue);
      }
    }

    // go through custom field config keys
    for (const [key, value] of Object.entries(fieldConfig.defaults.custom)) {
      const newValue: string = typeof value !== 'string' ? JSON.stringify(value) : value;
      const oldValue: string =
        typeof value !== 'string' ? JSON.stringify(oldDefaults.custom[key]) : oldDefaults.custom[key];

      if (oldDefaults.custom[key] === undefined) {
        logEvent('new custom field config', key, newValue);
      } else if (oldValue !== newValue) {
        logEvent('custom field config changed', key, newValue, oldValue);
      }
    }

    // overrides are an array of objects, so stringify it all and log changes
    // in lack of an index, we can't tell which override changed
    if (oldFieldConfig.overrides !== fieldConfig.overrides) {
      logEvent(
        'field config overrides changed',
        'overrides',
        JSON.stringify(fieldConfig.overrides),
        JSON.stringify(oldFieldConfig.overrides)
      );
    }
  };

  useEffect(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        faro.api.pushMeasurement({
          type: 'internal_panel_measurements_' + props.panelType,
          values: {
            start_loading_time_ms: startLoadTime,
            load_time_ms: performance.now() - startLoadTime,
          },
          // should be fixed by https://github.com/grafana/faro-web-sdk/pull/256/
          // {
          //   context: {
          //     panel_type: props.panelType,
          //   }
          // }
        });
      }, 0);
    });

    //we don't want to sub for every panel in dashboard, only for one in edit
    if (props.isInPanelEdit) {
      const sub = appEvents.subscribe(DashboardSavedEvent, logChanges);

      return () => {
        //exiting panel edit mode or changing panel type will auto log changes and unsub
        logChanges();
        sub.unsubscribe();
      };
    }

    return;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return props.children;
};
