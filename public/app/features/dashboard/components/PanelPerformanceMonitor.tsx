import afterFrame from 'afterframe';
import { useCallback, useEffect } from 'react';
import { usePrevious } from 'react-use';

import { FieldConfig, FieldConfigSource, TimeRange } from '@grafana/data';
import { faro } from '@grafana/faro-web-sdk';
import appEvents from 'app/core/app_events';
import { DashboardSavedEvent } from 'app/types/events';

interface Props {
  children: JSX.Element;
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

  const oldPanelOptions = usePrevious(props.panelOptions);
  const oldPanelFieldConfig = usePrevious(props.panelFieldConfig);
  const oldOverrides = usePrevious(props.panelFieldConfig.overrides);
  const oldTimeRange = usePrevious(props.timeRange);

  const logEvent = useCallback(
    (eventName: string, newKey: string, newVal: string, oldVal?: string) => {
      const logObj = {
        key: newKey,
        newValue: newVal,
        oldValue: oldVal ?? '',
        panelTitle: props.panelTitle,
        panelId: panelIdStr,
      };

      console.log(eventName);
      console.log(logObj);

      faro.api.pushEvent(eventName, logObj, props.panelType + '_panel');
    },
    [panelIdStr, props.panelTitle, props.panelType]
  );

  const logFieldConfigDefaults = useCallback(
    (fieldConfig: FieldConfig<any>, oldFieldConfig: FieldConfig<any>) => {
      // go through field config keys except custom, we treat that below
      for (const [key, value] of Object.entries(fieldConfig)) {
        const newValue: string = JSON.stringify(value);
        const oldValue: string = JSON.stringify(oldFieldConfig[key as keyof FieldConfig]);

        if (key === 'custom') {
          continue;
        }

        if (oldFieldConfig[key as keyof FieldConfig] === undefined) {
          logEvent('new field config', key, newValue);
        } else if (oldValue !== newValue) {
          logEvent('field config changed', key, newValue, oldValue);
        }
      }

      // go through custom field config keys
      for (const [key, value] of Object.entries(fieldConfig.custom)) {
        const newValue: string = typeof value !== 'string' ? JSON.stringify(value) : value;
        const oldValue: string =
          typeof value !== 'string'
            ? JSON.stringify(oldFieldConfig.custom[key as keyof FieldConfig])
            : oldFieldConfig.custom[key as keyof FieldConfig];

        if (oldFieldConfig.custom[key] === undefined) {
          logEvent('new custom field config', key, newValue);
        } else if (oldValue !== newValue) {
          logEvent('custom field config changed', key, newValue, oldValue);
        }
      }
    },
    [logEvent]
  );

  useEffect(() => {
    if (oldPanelOptions === undefined) {
      return;
    }

    for (const [key, value] of Object.entries(props.panelOptions)) {
      const newValue: string = JSON.stringify(value);
      const oldValue: string = JSON.stringify(oldPanelOptions[key]);

      if (oldPanelOptions[key] === undefined) {
        logEvent('new panel option', key, newValue);
      } else if (oldValue !== newValue) {
        logEvent('panel option changed', key, newValue, oldValue);
      }
    }
  }, [logEvent, oldPanelOptions, props.panelOptions]);

  useEffect(() => {
    if (oldPanelFieldConfig === undefined) {
      return;
    }

    if (oldPanelFieldConfig.defaults !== props.panelFieldConfig.defaults) {
      logFieldConfigDefaults(props.panelFieldConfig.defaults, oldPanelFieldConfig.defaults);
    }

    console.log(oldOverrides, props.panelFieldConfig);

    // this is an array and without knowing the index of the rule that changed, we can't tell which one changed
    if (oldPanelFieldConfig.overrides !== props.panelFieldConfig.overrides) {
      logEvent(
        'field config overrides changed',
        'overrides',
        JSON.stringify(props.panelFieldConfig.overrides),
        JSON.stringify(oldPanelFieldConfig.overrides)
      );
    }
  }, [logEvent, logFieldConfigDefaults, oldOverrides, oldPanelFieldConfig, props.panelFieldConfig]);

  useEffect(() => {
    if (oldTimeRange === undefined) {
      return;
    }

    const from = props.timeRange.from.toDate();
    const to = props.timeRange.to.toDate();
    const oldFrom = oldTimeRange.from.toDate();
    const oldTo = oldTimeRange.to.toDate();

    if (from.getTime() !== oldFrom.getTime() || to.getTime() !== oldTo.getTime()) {
      console.log('Time range changed');
      faro.api.pushEvent(
        'time range changed',
        {
          oldFrom: oldFrom.toDateString(),
          oldTo: oldTo.toDateString(),
          from: from.toDateString(),
          to: to.toDateString(),
          panelTitle: props.panelTitle,
        },
        props.panelType + '_panel'
      );
    }
  }, [oldTimeRange, props.panelTitle, props.panelType, props.timeRange.from, props.timeRange.to]);

  useEffect(() => {
    const sub = appEvents.subscribe(DashboardSavedEvent, () => {
      console.log('SAVED');
    });

    afterFrame(() => {
      faro.api.pushMeasurement(
        {
          type: 'internal_panel_measurements_' + props.panelType,
          values: {
            start_loading_time_ms: startLoadTime,
            load_time_ms: performance.now() - startLoadTime,
          },
        }
        // should be fixed by https://github.com/grafana/faro-web-sdk/pull/256/
        // {
        //   context: {
        //     panel_type: props.panelType,
        //   }
        // }
      );
    });

    return () => {
      sub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return props.children;
};
