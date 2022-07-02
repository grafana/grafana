import { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { CartesianCoords2D } from '@grafana/data';
import { UPlotConfigBuilder } from '@grafana/ui';
import { positionTooltip } from '@grafana/ui/src/components/uPlot/plugins/TooltipPlugin';

export type HoverEvent = {
  xIndex: number;
  yIndex: number;
  pageX: number;
  pageY: number;
};

type SetupConfigParams = {
  config: UPlotConfigBuilder;
  onUPlotClick: () => void;
  setFocusedSeriesIdx: Dispatch<SetStateAction<number | null>>;
  setFocusedPointIdx: Dispatch<SetStateAction<number | null>>;
  setCoords: Dispatch<SetStateAction<CartesianCoords2D | null>>;
  setHover: Dispatch<SetStateAction<HoverEvent | undefined>>;
  isToolTipOpen: MutableRefObject<boolean>;
};

// This applies config hooks to setup tooltip listener. Ideally this could happen in the same `prepConfig` function
// however the GraphNG structures do not allow access to the `setHover` callback
export const setupConfig = ({
  config,
  onUPlotClick,
  setFocusedSeriesIdx,
  setFocusedPointIdx,
  setCoords,
  setHover,
  isToolTipOpen,
}: SetupConfigParams): UPlotConfigBuilder => {
  config.addHook('init', (u) => {
    u.root.parentElement?.addEventListener('click', onUPlotClick);
    u.over.addEventListener('mouseleave', () => {
      if (!isToolTipOpen.current) {
        setCoords(null);
      }
    });
  });

  let rect: DOMRect;
  // rect of .u-over (grid area)
  config.addHook('syncRect', (u, r) => {
    rect = r;
  });

  const tooltipInterpolator = config.getTooltipInterpolator();
  if (tooltipInterpolator) {
    config.addHook('setCursor', (u) => {
      tooltipInterpolator(
        setFocusedSeriesIdx,
        setFocusedPointIdx,
        (clear) => {
          if (clear && !isToolTipOpen.current) {
            setCoords(null);
            return;
          }

          if (!rect) {
            return;
          }

          const { x, y } = positionTooltip(u, rect);
          if (x !== undefined && y !== undefined && !isToolTipOpen.current) {
            setCoords({ x, y });
          }
        },
        u
      );
    });
  }

  config.addHook('setLegend', (u) => {
    if (!isToolTipOpen.current) {
      setFocusedPointIdx(u.legend.idx!);
    }
    if (u.cursor.idxs != null) {
      for (let i = 0; i < u.cursor.idxs.length; i++) {
        const sel = u.cursor.idxs[i];
        if (sel != null) {
          const hover: HoverEvent = {
            xIndex: sel,
            yIndex: 0,
            pageX: rect.left + u.cursor.left!,
            pageY: rect.top + u.cursor.top!,
          };

          if (!isToolTipOpen.current || !hover) {
            setHover(hover);
          }

          return; // only show the first one
        }
      }
    }
  });

  config.addHook('setSeries', (_, idx) => {
    if (!isToolTipOpen.current) {
      setFocusedSeriesIdx(idx);
    }
  });

  return config;
};
