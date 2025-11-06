import { useLayoutEffect } from 'react';
import uPlot from 'uplot';

import { getFeatureToggle } from '../../../utils/featureToggle';
import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

const MIN_PAN_DIST = 5;

/**
 * Enables panning the time range by click and dragging x-axis labels with the mouse.
 * Provides visual feedback (grab/grabbing cursor) and real-time grid updates during drag.
 * @internal - exported for testing only
 */
export const setupXAxisPan = (
  u: uPlot,
  config: UPlotConfigBuilder,
  queryZoom: (range: { from: number; to: number }) => void
) => {
  let xAxes = u.root.querySelectorAll('.u-axis');
  let xAxis = xAxes[0];

  if (!xAxis || !(xAxis instanceof HTMLElement)) {
    return;
  }

  const xAxisEl = xAxis;

  xAxisEl.addEventListener('mouseenter', () => {
    xAxisEl.style.cursor = 'grab';
  });

  xAxisEl.addEventListener('mouseleave', () => {
    xAxisEl.style.cursor = '';
  });

  xAxisEl.addEventListener('mousedown', (e: Event) => {
    if (!(e instanceof MouseEvent)) {
      return;
    }
    e.preventDefault();

    xAxisEl.style.cursor = 'grabbing';

    let xScale = u.scales.x;

    let rect = u.over.getBoundingClientRect();
    let startX = e.clientX - rect.left;
    let startMin = xScale.min!;
    let startMax = xScale.max!;
    let unitsPerPx = (startMax - startMin) / (u.bbox.width / uPlot.pxRatio);

    let onMove = (e: MouseEvent) => {
      e.preventDefault();

      let currentX = e.clientX - rect.left;
      let dx = currentX - startX;
      let shiftBy = dx * unitsPerPx;

      let panMin = startMin - shiftBy;
      let panMax = startMax - shiftBy;

      config.setState(true, panMin, panMax);

      u.setScale('x', {
        min: panMin,
        max: panMax,
      });
    };

    let onUp = (e: MouseEvent) => {
      let endX = e.clientX - rect.left;
      let dx = endX - startX;

      xAxisEl.style.cursor = 'grab';

      config.setState(false);

      if (Math.abs(dx) >= MIN_PAN_DIST) {
        let shiftBy = dx * unitsPerPx;

        queryZoom({
          from: startMin - shiftBy,
          to: startMax - shiftBy,
        });
      }

      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
};

export interface XAxisInteractionAreaPluginProps {
  config: UPlotConfigBuilder;
  queryZoom?: (range: { from: number; to: number }) => void;
}

/**
 * Plugin for handling x-axis area interactions, such as time range panning.
 */
export const XAxisInteractionAreaPlugin = ({ config, queryZoom }: XAxisInteractionAreaPluginProps) => {
  useLayoutEffect(() => {
    config.addHook('init', (u) => {
      if (queryZoom != null && getFeatureToggle('timeRangePan')) {
        setupXAxisPan(u, config, queryZoom);
      }
    });
  }, [config, queryZoom]);

  return null;
};
