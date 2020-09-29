import React, { useState, useCallback, useEffect } from 'react';
import { Global, css as cssCore } from '@emotion/core';

import { PlotPluginProps } from '../types';
import { usePlotPluginContext } from '../context';
import { pluginLog } from '../utils';
import { CursorPlugin } from './CursorPlugin';

interface ClickPluginAPI {
  point: { seriesIdx: number | null; dataIdx: number | null };
  coords: {
    // coords relative to plot canvas, css px
    plotCanvas: Coords;
    // coords relative to viewport , css px
    viewport: Coords;
  };
  // coords relative to plot canvas, css px
  clearSelection: () => void;
}

interface ClickPluginProps extends PlotPluginProps {
  onClick: (e: { seriesIdx: number | null; dataIdx: number | null }) => void;
  children: (api: ClickPluginAPI) => React.ReactElement | null;
}

interface Coords {
  x: number;
  y: number;
}

// Exposes API for Graph click interactions
export const ClickPlugin: React.FC<ClickPluginProps> = ({ id, onClick, children }) => {
  const pluginId = `ClickPlugin:${id}`;

  const pluginsApi = usePlotPluginContext();
  const [point, setPoint] = useState<{ seriesIdx: number | null; dataIdx: number | null } | null>(null);

  const clearSelection = useCallback(() => {
    pluginLog(pluginId, false, 'clearing click selection');
    setPoint(null);
  }, [setPoint]);

  useEffect(() => {
    const unregister = pluginsApi.registerPlugin({
      id: pluginId,
      hooks: {
        init: u => {
          pluginLog(pluginId, false, 'init');

          // for naive click&drag check
          let isClick = false;
          // REF: https://github.com/leeoniya/uPlot/issues/239
          let pts = Array.from(u.root.querySelectorAll<HTMLDivElement>('.u-cursor-pt'));
          const plotCanvas = u.root.querySelector<HTMLDivElement>('.u-over');

          plotCanvas!.addEventListener('mousedown', (e: MouseEvent) => {
            isClick = true;
          });
          plotCanvas!.addEventListener('mousemove', (e: MouseEvent) => {
            isClick = false;
          });

          // TODO: remove listeners on unmount
          plotCanvas!.addEventListener('mouseup', (e: MouseEvent) => {
            if (!isClick) {
              setPoint(null);
              return;
            }
            isClick = true;
            pluginLog(pluginId, false, 'canvas click');

            if (e.target) {
              const target = e.target as HTMLElement;
              if (!target.classList.contains('u-cursor-pt')) {
                setPoint({ seriesIdx: null, dataIdx: null });
              }
            }
          });

          if (pts.length > 0) {
            pts.forEach((pt, i) => {
              // TODO: remove listeners on unmount
              pt.addEventListener('click', e => {
                const seriesIdx = i + 1;
                const dataIdx = u.cursor.idx;

                pluginLog(id, false, seriesIdx, dataIdx);
                setPoint({ seriesIdx, dataIdx: dataIdx || null });
                onClick({ seriesIdx, dataIdx: dataIdx || null });
              });
            });
          }
        },
      },
    });

    return () => {
      unregister();
    };
  }, []);

  return (
    <>
      <Global
        styles={cssCore`
        .uplot .u-cursor-pt {
          pointer-events: auto !important;
        }
      `}
      />
      <CursorPlugin id={pluginId} capture="mousedown" lock>
        {({ coords }) => {
          if (!point) {
            return null;
          }

          return children({
            point,
            coords,
            clearSelection,
          });
        }}
      </CursorPlugin>
    </>
  );
};
