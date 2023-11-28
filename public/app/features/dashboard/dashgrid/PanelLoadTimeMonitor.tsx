import { useEffect } from 'react';

import { faro } from '@grafana/faro-web-sdk';
import { config } from 'app/core/config';
import { PanelLogEvents } from 'app/core/log_events';

interface Props {
  panelType: string;
  panelId: number;
  panelTitle: string;
}

export const PanelLoadTimeMonitor = (props: Props) => {
  const startLoadTime = performance.now();

  useEffect(() => {
    if (!config.grafanaJavascriptAgent.enabled) {
      return;
    }

    // This code will be run ASAP after Style and Layout information have
    // been calculated and the paint has occurred.
    // https://firefox-source-docs.mozilla.org/performance/bestpractices.html
    requestAnimationFrame(() => {
      setTimeout(() => {
        faro.api.pushMeasurement(
          {
            type: PanelLogEvents.MEASURE_PANEL_LOAD_TIME_EVENT,
            values: {
              start_loading_time_ms: startLoadTime,
              load_time_ms: performance.now() - startLoadTime,
            },
          },
          {
            context: {
              panel_type: props.panelType,
              panel_id: String(props.panelId),
              panel_title: props.panelTitle,
            },
          }
        );
      }, 0);
    });

    return;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};
