import React, { useEffect, useLayoutEffect, useState } from 'react';
import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';
// import { pluginLog } from '../utils';
// import { PlotSelection } from '../types';
import uPlot from 'uplot';

interface KeyboardPluginProps {
  config: UPlotConfigBuilder; // onkeypress, onkeyup, onkeydown (triggered by vizlayout handlers)
}

/**
 * @alpha
 */
export const KeyboardPlugin: React.FC<KeyboardPluginProps> = ({ config }) => {
  // const [selection, setSelection] = useState<PlotSelection | null>(null);

  // useEffect(() => {
  //   if (selection) {
  //     pluginLog('ZoomPlugin', false, 'selected', selection);
  //     if (selection.bbox.width < MIN_ZOOM_DIST) {
  //       return;
  //     }
  //     onZoom({ from: selection.min, to: selection.max });
  //   }
  // }, [selection]);

  useLayoutEffect(() => {
    let plotInstance: uPlot | undefined = undefined;
    let bbox: DOMRect | undefined = undefined;

    // cache uPlot plotting area bounding box
    config.addHook('syncRect', (u, rect) => {
      bbox = rect;
    });

    config.addHook('init', (u) => {
      plotInstance = u;

      let vizLayoutViz = u.root.closest('[tabindex]');

      let knownKeys = new Set(['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']);
      let pressedKeys = new Set();

      let pxPerKeydownMin = 1;
      let pxPerKeydownMax = 100;
      let rampCount = 200;
      let count = -1;

      let isDragging = false;

      vizLayoutViz?.addEventListener('keydown', (e) => {
        if (!knownKeys.has(e.key)) {
          return;
        }

        let left = u.cursor.left!;
        let top = u.cursor.top!;

        pressedKeys.add(e.key);

        count++;

        let dpx = pxPerKeydownMin + Math.min(count / rampCount, 1) * (pxPerKeydownMax - pxPerKeydownMin);

        left += pressedKeys.has('ArrowRight') ? dpx : pressedKeys.has('ArrowLeft') ? -dpx : 0;
        top += pressedKeys.has('ArrowDown') ? dpx : pressedKeys.has('ArrowUp') ? -dpx : 0;

        // dispatch mouse events
        let move = new MouseEvent('mousemove', { clientX: bbox!.left + left, clientY: bbox!.top + top });
        u.over.dispatchEvent(move);

        if (!isDragging && e.shiftKey) {
          isDragging = true;
          let down = new MouseEvent('mousedown', { clientX: bbox!.left + left, clientY: bbox!.top + top, button: 1 });
          u.over.dispatchEvent(down);
        }
      });

      vizLayoutViz?.addEventListener('keyup', (e) => {
        if (isDragging && e.key === 'Shift') {
          isDragging = false;
          let up = new MouseEvent('mouseup', {
            clientX: bbox!.left + u.cursor.left,
            clientY: bbox!.top + u.cursor.top,
            button: 1,
          });
          u.over.dispatchEvent(up);
        }

        if (knownKeys.has(e.key)) {
          pressedKeys.delete(e.key);

          if (pressedKeys.size === 0) {
            count = -1;
          }
        }
      });

      vizLayoutViz?.addEventListener('focus', (e) => {
        // let enter = new MouseEvent('mouseenter');
        // u.over.dispatchEvent(enter);

        u.setCursor({ left: bbox!.width / 2, top: bbox!.height / 2 });
      });

      vizLayoutViz?.addEventListener('blur', (e) => {
        // let enter = new MouseEvent('mouseleave');
        // u.over.dispatchEvent(enter);

        u.setCursor({ left: -10, top: -10 });
      });
    });
  }, [config]);

  return null;
};
