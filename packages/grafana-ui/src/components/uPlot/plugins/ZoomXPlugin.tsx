import { useLayoutEffect } from 'react';

import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

interface ZoomXPluginProps {
  onZoom: (from: number, to: number) => void;
  builder: UPlotConfigBuilder;
}

// min px width that triggers zoom
const MIN_ZOOM_DIST = 5;
const xScaleKey = 'x';

/**
 * @alpha
 */
export const ZoomXPlugin = ({ onZoom, builder }: ZoomXPluginProps) => {
  useLayoutEffect(() => {
    builder.addHook('setSelect', (u) => {
      if (u.select.width >= MIN_ZOOM_DIST && !u.cursor.event?.ctrlKey && !u.cursor.event?.metaKey) {
        onZoom(u.posToVal(u.select.left, xScaleKey), u.posToVal(u.select.left + u.select.width, xScaleKey));
        u.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);
      }
    });

    // zoom out on dblclick
    builder.setCursor({
      bind: {
        dblclick: (u) => () => {
          let xScale = u.scales.x;

          const frTs = xScale.min!;
          const toTs = xScale.max!;
          const pad = (toTs - frTs) / 2;

          onZoom(frTs - pad, toTs + pad);

          return null;
        },
      },
    });
  }, [builder]);

  return null;
};
