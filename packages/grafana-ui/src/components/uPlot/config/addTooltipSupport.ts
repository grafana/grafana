import { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { CartesianCoords2D } from '@grafana/data';

import { positionTooltip } from '../plugins/TooltipPlugin';

import { UPlotConfigBuilder } from './UPlotConfigBuilder';

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
  setCoords: Dispatch<SetStateAction<{ viewport: CartesianCoords2D; canvas: CartesianCoords2D } | null>>;
  setHover: Dispatch<SetStateAction<HoverEvent | undefined>>;
  isToolTipOpen: MutableRefObject<boolean>;
};

// This applies config hooks to setup tooltip listener. Ideally this could happen in the same `prepConfig` function
// however the GraphNG structures do not allow access to the `setHover` callback
export const addTooltipSupport = ({
  config,
  onUPlotClick,
  setFocusedSeriesIdx,
  setFocusedPointIdx,
  setCoords,
  setHover,
  isToolTipOpen,
}: SetupConfigParams): UPlotConfigBuilder => {
  // Ensure tooltip is closed on config changes
  isToolTipOpen.current = false;

  const onMouseLeave = () => {
    if (!isToolTipOpen.current) {
      setCoords(null);
    }
  };

  let ref_parent: HTMLElement | null = null;
  let ref_over: HTMLElement | null = null;
  config.addHook('init', (u) => {
    ref_parent = u.root.parentElement;
    ref_over = u.over;
    ref_parent?.addEventListener('click', onUPlotClick);
    ref_over.addEventListener('mouseleave', onMouseLeave);
  });

  const clearPopupIfOpened = () => {
    if (isToolTipOpen.current) {
      setCoords(null);
      onUPlotClick();
    }
  };

  config.addHook('drawClear', clearPopupIfOpened);

  config.addHook('destroy', () => {
    ref_parent?.removeEventListener('click', onUPlotClick);
    ref_over?.removeEventListener('mouseleave', onMouseLeave);
    clearPopupIfOpened();
  });

  let rect: DOMRect;
  // rect of .u-over (grid area)
  config.addHook('syncRect', (u, r) => {
    rect = r;
  });

  const tooltipInterpolator = config.getTooltipInterpolator();
  if (tooltipInterpolator) {
    config.addHook('setCursor', (u) => {
      if (isToolTipOpen.current) {
        return;
      }

      tooltipInterpolator(
        setFocusedSeriesIdx,
        setFocusedPointIdx,
        (clear) => {
          if (clear) {
            setCoords(null);
            return;
          }

          if (!rect) {
            return;
          }

          const { x, y } = positionTooltip(u, rect);
          if (x !== undefined && y !== undefined) {
            setCoords({ canvas: { x: u.cursor.left!, y: u.cursor.top! }, viewport: { x, y } });
          }
        },
        u
      );
    });
  }

  config.addHook('setLegend', (u) => {
    if (!isToolTipOpen.current && !tooltipInterpolator) {
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
