import { useLayoutEffect } from 'react';

import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';
import { pluginLog } from '../utils';

interface ZoomPluginProps {
  onZoom: (range: { from: number; to: number }) => void;
  config: UPlotConfigBuilder;
}

// min px width that triggers zoom
const MIN_ZOOM_DIST = 5;

/**
 * @alpha
 */
export const ZoomPlugin = ({ onZoom, config }: ZoomPluginProps) => {
  useLayoutEffect(() => {
    config.addHook('setSelect', (u) => {
      const min = u.posToVal(u.select.left, 'x');
      const max = u.posToVal(u.select.left + u.select.width, 'x');

      if (u.select.width >= MIN_ZOOM_DIST) {
        pluginLog('ZoomPlugin', false, 'selected', {
          min,
          max,
          bbox: {
            left: u.bbox.left / window.devicePixelRatio + u.select.left,
            top: u.bbox.top / window.devicePixelRatio,
            height: u.bbox.height / window.devicePixelRatio,
            width: u.select.width,
          },
        });
        onZoom({ from: min, to: max });
      }

      // manually hide selected region (since cursor.drag.setScale = false)
      /* @ts-ignore */
      u.setSelect({ left: 0, width: 0 }, false);
    });

    config.setCursor({
      bind: {
        dblclick: (u) => () => {
          let xScale = u.scales.x;

          const frTs = xScale.min!;
          const toTs = xScale.max!;
          const pad = (toTs - frTs) / 2;

          onZoom({ from: frTs - pad, to: toTs + pad });

          return null;
        },
      },
    });
  }, [config]);

  return null;
};
