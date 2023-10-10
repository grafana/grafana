import { useLayoutEffect } from 'react';

import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

interface ZoomPluginProps {
  onZoom: (range: { from: number; to: number }) => void;
  withZoomY?: boolean;
  config: UPlotConfigBuilder;
}

// min px width that triggers zoom
const MIN_ZOOM_DIST = 5;

/**
 * @alpha
 */
export const ZoomPlugin = ({ onZoom, config, withZoomY = false }: ZoomPluginProps) => {
  useLayoutEffect(() => {
    let yZoomed = false;
    let yDrag = false;

    if (withZoomY) {
      config.addHook('init', (u) => {
        u.root!.addEventListener(
          'mousedown',
          (e) => {
            if (e.button === 0 && e.shiftKey) {
              yDrag = true;

              u.cursor!.drag!.x = false;
              u.cursor!.drag!.y = true;

              let onUp = (e: MouseEvent) => {
                u.cursor!.drag!.x = true;
                u.cursor!.drag!.y = false;
                document.removeEventListener('mouseup', onUp, true);
              };

              document.addEventListener('mouseup', onUp, true);
            }
          },
          true
        );
      });
    }

    config.addHook('setSelect', (u) => {
      if (withZoomY && yDrag) {
        if (u.select.height >= MIN_ZOOM_DIST) {
          for (let key in u.scales!) {
            if (key !== 'x') {
              const maxY = u.posToVal(u.select.top, key);
              const minY = u.posToVal(u.select.top + u.select.height, key);

              u.setScale(key, { min: minY, max: maxY });
            }
          }

          yZoomed = true;
        }

        yDrag = false;
      } else {
        if (u.select.width >= MIN_ZOOM_DIST) {
          const minX = u.posToVal(u.select.left, 'x');
          const maxX = u.posToVal(u.select.left + u.select.width, 'x');

          onZoom({ from: minX, to: maxX });
        }
      }

      // manually hide selected region (since cursor.drag.setScale = false)
      u.setSelect({ left: 0, width: 0, top: 0, height: 0 }, false);
    });

    config.setCursor({
      bind: {
        dblclick: (u) => () => {
          if (withZoomY && yZoomed) {
            for (let key in u.scales!) {
              if (key !== 'x') {
                // @ts-ignore (this is not typed correctly in uPlot, assigning nulls means auto-scale / reset)
                u.setScale(key, { min: null, max: null });
              }
            }

            yZoomed = false;
          } else {
            let xScale = u.scales.x;

            const frTs = xScale.min!;
            const toTs = xScale.max!;
            const pad = (toTs - frTs) / 2;

            onZoom({ from: frTs - pad, to: toTs + pad });
          }

          return null;
        },
      },
    });
  }, [config]);

  return null;
};
