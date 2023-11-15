import { css } from '@emotion/css';
import React, { useLayoutEffect, useRef, useReducer, CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import uPlot from 'uplot';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes';
import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

import { CloseButton } from './CloseButton';

// todo: barchart? histogram?
export const enum TooltipHoverMode {
  // Single mode in TimeSeries, Candlestick, Trend, StateTimeline, Heatmap?
  xOne,
  // All mode in TimeSeries, Candlestick, Trend, StateTimeline, Heatmap?
  xAll,
  // Single mode in XYChart, Heatmap?
  xyOne,
}

interface TooltipPlugin2Props {
  config: UPlotConfigBuilder;
  hoverMode: TooltipHoverMode;
  render: (
    u: uPlot,
    dataIdxs: Array<number | null>,
    seriesIdx: number | null,
    isPinned: boolean,
    dismiss: () => void
  ) => React.ReactNode;
}

interface TooltipContainerState {
  plot?: uPlot | null;
  style: Partial<CSSProperties>;
  isHovering: boolean;
  isPinned: boolean;
  dismiss: () => void;
  contents?: React.ReactNode;
}

interface TooltipContainerSize {
  observer: ResizeObserver;
  width: number;
  height: number;
}

function mergeState(prevState: TooltipContainerState, nextState: Partial<TooltipContainerState>) {
  return {
    ...prevState,
    ...nextState,
    style: {
      ...prevState.style,
      ...nextState.style,
    },
  };
}

const INITIAL_STATE: TooltipContainerState = {
  style: { transform: '', pointerEvents: 'none' },
  isHovering: false,
  isPinned: false,
  contents: null,
  plot: null,
  dismiss: () => {},
};

/**
 * @alpha
 */
export const TooltipPlugin2 = ({ config, hoverMode, render }: TooltipPlugin2Props) => {
  const domRef = useRef<HTMLDivElement>(null);

  const [{ plot, isHovering, isPinned, contents, style, dismiss }, setState] = useReducer(mergeState, INITIAL_STATE);

  const sizeRef = useRef<TooltipContainerSize>();

  const styles = useStyles2(getStyles);

  const renderRef = useRef(render);
  renderRef.current = render;

  useLayoutEffect(() => {
    sizeRef.current = {
      width: 0,
      height: 0,
      observer: new ResizeObserver((entries) => {
        let size = sizeRef.current!;

        for (const entry of entries) {
          if (entry.borderBoxSize?.length > 0) {
            size.width = entry.borderBoxSize[0].inlineSize;
            size.height = entry.borderBoxSize[0].blockSize;
          } else {
            size.width = entry.contentRect.width;
            size.height = entry.contentRect.height;
          }
        }
      }),
    };

    let _plot = plot;
    let _isHovering = isHovering;
    let _isPinned = isPinned;
    let _style = style;

    let offsetX = 0;
    let offsetY = 0;

    let htmlEl = document.documentElement;
    let winWidth = htmlEl.clientWidth - 16;
    let winHeight = htmlEl.clientHeight - 16;

    window.addEventListener('resize', (e) => {
      winWidth = htmlEl.clientWidth - 5;
      winHeight = htmlEl.clientHeight - 5;
    });

    let closestSeriesIdx: number | null = null;

    let pendingRender = false;
    let pendingPinned = false;

    const scheduleRender = (setPinned = false) => {
      if (!pendingRender) {
        // defer unrender for 100ms to reduce flickering in small gaps
        if (!_isHovering) {
          setTimeout(_render, 100);
        } else {
          queueMicrotask(_render);
        }

        pendingRender = true;
      }

      if (setPinned) {
        pendingPinned = true;
      }
    };

    // in some ways this is similar to ClickOutsideWrapper.tsx
    const downEventOutside = (e: Event) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      let isOutside = (e.target as HTMLDivElement).closest(`.${styles.tooltipWrapper}`) !== domRef.current;

      if (isOutside) {
        dismiss();
      }
    };

    const _render = () => {
      pendingRender = false;

      if (pendingPinned) {
        _style = { pointerEvents: _isPinned ? 'all' : 'none' };

        domRef.current!.closest<HTMLDivElement>('.react-grid-item')?.classList.toggle('context-menu-open', _isPinned);

        // @ts-ignore
        _plot!.cursor._lock = _isPinned;

        if (_isPinned) {
          document.addEventListener('mousedown', downEventOutside, true);
          document.addEventListener('keydown', downEventOutside, true);
        } else {
          document.removeEventListener('mousedown', downEventOutside, true);
          document.removeEventListener('keydown', downEventOutside, true);
        }

        pendingPinned = false;
      }

      let state: TooltipContainerState = {
        style: _style,
        isPinned: _isPinned,
        isHovering: _isHovering,
        contents: _isHovering
          ? renderRef.current(_plot!, _plot!.cursor.idxs!, closestSeriesIdx, _isPinned, dismiss)
          : null,
        dismiss,
      };

      setState(state);
    };

    const dismiss = () => {
      _isPinned = false;
      _isHovering = false;
      _plot!.setCursor({ left: -10, top: -10 });
      scheduleRender(true);
    };

    config.addHook('init', (u) => {
      setState({ plot: (_plot = u) });

      // this handles pinning
      u.over.addEventListener('click', (e) => {
        // only pinnable tooltip is visible *and* is within proximity to series/point
        if (_isHovering && closestSeriesIdx != null && !_isPinned && e.target === u.over) {
          _isPinned = true;
          scheduleRender(true);
        }
      });
    });

    // fires on data value hovers/unhovers (before setSeries)
    config.addHook('setLegend', (u) => {
      let hoveredSeriesIdx = _plot!.cursor.idxs!.findIndex((v, i) => i > 0 && v != null);
      let _isHoveringNow = hoveredSeriesIdx !== -1;

      // in mode: 2 uPlot won't fire the proximity-based setSeries (below)
      // so we set closestSeriesIdx here instead
      // TODO: setSeries only fires for TimeSeries & Trend...not state timeline or statsus history
      if (hoverMode === TooltipHoverMode.xyOne) {
        closestSeriesIdx = hoveredSeriesIdx;
      }

      if (_isHoveringNow) {
        // create
        if (!_isHovering) {
          _isHovering = true;
        }
      } else {
        // destroy...TODO: debounce this
        if (_isHovering) {
          _isHovering = false;
        }
      }

      scheduleRender();
    });

    // fires on series focus/proximity changes
    // e.g. to highlight the hovered/closest series
    // TODO: we only need this for multi/all mode?
    config.addHook('setSeries', (u, seriesIdx) => {
      // don't jiggle focused series styling when there's only one series
      // const isMultiSeries = u.series.length > 2;

      // if (hoverModeRef.current === TooltipHoverMode.xAll && closestSeriesIdx !== seriesIdx) {
      closestSeriesIdx = seriesIdx;
      scheduleRender();
      // }
    });

    // fires on mousemoves
    config.addHook('setCursor', (u) => {
      let { left = -10, top = -10 } = u.cursor;

      if (left >= 0 || top >= 0) {
        let { width, height } = sizeRef.current!;

        let clientX = u.rect.left + left;
        let clientY = u.rect.top + top;

        if (offsetY) {
          if (clientY + height < winHeight || clientY - height < 0) {
            offsetY = 0;
          } else if (offsetY !== -height) {
            offsetY = -height;
          }
        } else {
          if (clientY + height > winHeight && clientY - height >= 0) {
            offsetY = -height;
          }
        }

        if (offsetX) {
          if (clientX + width < winWidth || clientX - width < 0) {
            offsetX = 0;
          } else if (offsetX !== -width) {
            offsetX = -width;
          }
        } else {
          if (clientX + width > winWidth && clientX - width >= 0) {
            offsetX = -width;
          }
        }

        const shiftX = offsetX !== 0 ? 'translateX(-100%)' : '';
        const shiftY = offsetY !== 0 ? 'translateY(-100%)' : '';

        // TODO: to a transition only when switching sides
        // transition: transform 100ms;

        const transform = `${shiftX} translateX(${left}px) ${shiftY} translateY(${top}px)`;

        if (_isHovering) {
          if (domRef.current != null) {
            domRef.current.style.transform = transform;
          } else {
            _style.transform = transform;
            scheduleRender();
          }
        }
      }
    });
  }, [config]);

  useLayoutEffect(() => {
    const size = sizeRef.current!;

    if (domRef.current != null) {
      size.observer.observe(domRef.current);
    }
  }, [domRef.current]);

  if (plot && isHovering) {
    return createPortal(
      <div className={styles.tooltipWrapper} style={style} ref={domRef}>
        {isPinned && <CloseButton onClick={dismiss} />}
        {contents}
      </div>,
      plot.over
    );
  }

  return null;
};

const getStyles = (theme: GrafanaTheme2) => ({
  tooltipWrapper: css({
    top: 0,
    left: 0,
    zIndex: theme.zIndex.tooltip,
    whiteSpace: 'pre',
    borderRadius: theme.shape.radius.default,
    position: 'absolute',
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    boxShadow: `0 4px 8px ${theme.colors.background.primary}`,
    userSelect: 'text',
  }),
});
