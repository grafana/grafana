import { useLayoutEffect } from 'react';
import uPlot from 'uplot';

import { getFeatureToggle } from '../../../utils/featureToggle';
import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

const MIN_PAN_DIST = 5;

/**
 * Calculates the new time range after a pan operation.
 *
 * @returns Object containing the new from and to time values
 * @internal - exported for testing only
 */
export const calculatePanRange = (
  timeFrom: number,
  timeTo: number,
  dragPixels: number,
  plotWidth: number
): { from: number; to: number } => {
  const unitsPerPx = (timeTo - timeFrom) / (plotWidth / uPlot.pxRatio);
  const timeShift = dragPixels * unitsPerPx;

  return {
    from: timeFrom - timeShift,
    to: timeTo - timeShift,
  };
};

/**
 * Enables panning the time range by click and dragging x-axis labels with the mouse.
 * Provides visual feedback (grab/grabbing cursor) and real-time grid updates during drag.
 *
 * @returns Cleanup function to remove event listeners
 * @internal - exported for testing only
 */
export const setupXAxisPan = (
  u: uPlot,
  config: UPlotConfigBuilder,
  queryZoom: (range: { from: number; to: number }) => void
): (() => void) => {
  let xAxes = u.root.querySelectorAll('.u-axis');
  let xAxis = xAxes[0];

  if (!xAxis || !(xAxis instanceof HTMLElement)) {
    return () => {};
  }

  const xAxisEl = xAxis;

  let activeMoveListener: ((e: MouseEvent) => void) | null = null;
  let activeUpListener: ((e: MouseEvent) => void) | null = null;

  const handleMouseEnter = () => {
    xAxisEl.style.cursor = 'grab';
  };

  const handleMouseLeave = () => {
    xAxisEl.style.cursor = '';
  };

  const handleMouseDown = (e: Event) => {
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

    const onMove = (e: MouseEvent) => {
      e.preventDefault();

      let currentX = e.clientX - rect.left;
      let dragPixels = currentX - startX;

      const { from, to } = calculatePanRange(startMin, startMax, dragPixels, u.bbox.width);

      config.setState({ isPanning: true, min: from, max: to });

      u.setScale('x', {
        min: from,
        max: to,
      });
    };

    const onUp = (e: MouseEvent) => {
      let endX = e.clientX - rect.left;
      let dragPixels = endX - startX;

      xAxisEl.style.cursor = 'grab';

      config.setState({ isPanning: false });

      if (Math.abs(dragPixels) >= MIN_PAN_DIST) {
        const newRange = calculatePanRange(startMin, startMax, dragPixels, u.bbox.width);
        queryZoom(newRange);
      }

      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      activeMoveListener = null;
      activeUpListener = null;
    };

    activeMoveListener = onMove;
    activeUpListener = onUp;

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  xAxisEl.addEventListener('mouseenter', handleMouseEnter);
  xAxisEl.addEventListener('mouseleave', handleMouseLeave);
  xAxisEl.addEventListener('mousedown', handleMouseDown);

  return () => {
    xAxisEl.removeEventListener('mouseenter', handleMouseEnter);
    xAxisEl.removeEventListener('mouseleave', handleMouseLeave);
    xAxisEl.removeEventListener('mousedown', handleMouseDown);

    if (activeMoveListener) {
      document.removeEventListener('mousemove', activeMoveListener);
    }
    if (activeUpListener) {
      document.removeEventListener('mouseup', activeUpListener);
    }
  };
};

export interface XAxisInteractionAreaPluginProps {
  config: UPlotConfigBuilder;
  queryZoom?: (range: { from: number; to: number }) => void;
}

/**
 * Plugin for handling x-axis area interactions, such as time range panning.
 * Properly manages event listener lifecycle to prevent memory leaks.
 */
export const XAxisInteractionAreaPlugin = ({ config, queryZoom }: XAxisInteractionAreaPluginProps) => {
  useLayoutEffect(() => {
    let cleanup: (() => void) | undefined;

    config.addHook('init', (u) => {
      if (queryZoom != null && getFeatureToggle('timeRangePan')) {
        cleanup = setupXAxisPan(u, config, queryZoom);
      }
    });

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [config, queryZoom]);

  return null;
};
