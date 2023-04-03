import { useEffect, useLayoutEffect, useState } from 'react';

import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';
import { PlotSelection } from '../types';
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
  const [selection, setSelection] = useState<PlotSelection | null>(null);

  useEffect(() => {
    if (selection) {
      pluginLog('ZoomPlugin', false, 'selected', selection);
      if (selection.bbox.width < MIN_ZOOM_DIST) {
        return;
      }
      onZoom({ from: selection.min, to: selection.max });
    }
  }, [selection]);

  useLayoutEffect(() => {
    config.addHook('setSelect', (u) => {
      const min = u.posToVal(u.select.left, 'x');
      const max = u.posToVal(u.select.left + u.select.width, 'x');

      setSelection({
        min,
        max,
        bbox: {
          left: u.bbox.left / window.devicePixelRatio + u.select.left,
          top: u.bbox.top / window.devicePixelRatio,
          height: u.bbox.height / window.devicePixelRatio,
          width: u.select.width,
        },
      });

      // manually hide selected region (since cursor.drag.setScale = false)
      /* @ts-ignore */
      u.setSelect({ left: 0, width: 0 }, false);
    });
  }, [config]);

  return null;
};
