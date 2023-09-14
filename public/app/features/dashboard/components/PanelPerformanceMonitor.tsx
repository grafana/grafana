import afterFrame from 'afterframe';
import { useEffect, useState } from 'react';

import { faro } from '@grafana/faro-web-sdk';

interface Props {
  children: JSX.Element;
  panelType: string;
}

export const PanelPerformanceMonitor = (props: Props) => {
  const [startLoadTime, _] = useState<number>(performance.now());

  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return props.children;
};
