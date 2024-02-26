import { css, cx } from '@emotion/css';
import React, { useLayoutEffect, useRef, useReducer, CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import uPlot from 'uplot';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes';
import { getPortalContainer } from '../../Portal/Portal';
import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

import { CloseButton } from './CloseButton';

export const DEFAULT_TOOLTIP_WIDTH = undefined;
export const DEFAULT_TOOLTIP_HEIGHT = undefined;
export const TOOLTIP_OFFSET = 10;

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

  syncTooltip?: () => boolean;

  // x only
  queryZoom?: (range: { from: number; to: number }) => void;
  // y-only, via shiftKey
  clientZoom?: boolean;

  render: (
    u: uPlot,
    dataIdxs: Array<number | null>,
    seriesIdx: number | null,
    isPinned: boolean,
    dismiss: () => void,
    // selected time range (for annotation triggering)
    timeRange: TimeRange2 | null,
    viaSync: boolean
  ) => React.ReactNode;

  maxWidth?: number;
  maxHeight?: number;
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

export interface TimeRange2 {
  from: number;
  to: number;
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

function initState(): TooltipContainerState {
  return {
    style: { transform: '', pointerEvents: 'none' },
    isHovering: false,
    isPinned: false,
    contents: null,
    plot: null,
    dismiss: () => {},
  };
}

// min px width that triggers zoom
const MIN_ZOOM_DIST = 5;

const maybeZoomAction = (e?: MouseEvent | null) => e != null && !e.ctrlKey && !e.metaKey;

/**
 * @alpha
 */
export const TooltipPlugin2 = ({
  config,
  hoverMode,
  render,
  clientZoom = false,
  queryZoom,
  maxWidth,
  maxHeight,
  syncTooltip = () => false,
}: TooltipPlugin2Props) => {
  const domRef = useRef<HTMLDivElement>(null);
  const portalRoot = useRef<HTMLElement | null>(null);

  if (portalRoot.current == null) {
    portalRoot.current = getPortalContainer();
  }

  const [{ plot, isHovering, isPinned, contents, style, dismiss }, setState] = useReducer(mergeState, null, initState);

  const sizeRef = useRef<TooltipContainerSize>();

  maxWidth = isPinned ? DEFAULT_TOOLTIP_WIDTH : maxWidth ?? DEFAULT_TOOLTIP_WIDTH;
  maxHeight ??= DEFAULT_TOOLTIP_HEIGHT;
  const styles = useStyles2(getStyles, maxWidth, maxHeight);

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

    let yZoomed = false;
    let yDrag = false;

    let _plot = plot;
    let _isHovering = isHovering;
    let _someSeriesIdx = false;
    let _isPinned = isPinned;
    let _style = style;

    let plotVisible = false;

    const updateHovering = () => {
      if (viaSync) {
        _isHovering = plotVisible && _someSeriesIdx && syncTooltip();
      } else {
        _isHovering = closestSeriesIdx != null || (hoverMode === TooltipHoverMode.xAll && _someSeriesIdx);
      }
    };

    let offsetX = 0;
    let offsetY = 0;

    let selectedRange: TimeRange2 | null = null;
    let seriesIdxs: Array<number | null> = plot?.cursor.idxs!.slice()!;
    let closestSeriesIdx: number | null = null;
    let viaSync = false;

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
      if (!domRef.current!.contains(e.target as Node)) {
        dismiss();
      }
    };

    const _render = () => {
      pendingRender = false;

      if (pendingPinned) {
        _style = { pointerEvents: _isPinned ? 'all' : 'none' };

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
        contents:
          _isHovering || selectedRange != null
            ? renderRef.current(_plot!, seriesIdxs, closestSeriesIdx, _isPinned, dismiss, selectedRange, viaSync)
            : null,
        dismiss,
      };

      setState(state);

      selectedRange = null;
    };

    const dismiss = () => {
      let prevIsPinned = _isPinned;
      _isPinned = false;
      _isHovering = false;
      _plot!.setCursor({ left: -10, top: -10 });
      scheduleRender(prevIsPinned);
    };

    config.addHook('init', (u) => {
      setState({ plot: (_plot = u) });

      // detect shiftKey and mutate drag mode from x-only to y-only
      if (clientZoom) {
        u.over.addEventListener(
          'mousedown',
          (e) => {
            if (!maybeZoomAction(e)) {
              return;
            }

            if (e.button === 0 && e.shiftKey) {
              yDrag = true;

              u.cursor.drag!.x = false;
              u.cursor.drag!.y = true;

              let onUp = (e: MouseEvent) => {
                u.cursor.drag!.x = true;
                u.cursor.drag!.y = false;
                document.removeEventListener('mouseup', onUp, true);
              };

              document.addEventListener('mouseup', onUp, true);
            }
          },
          true
        );
      }

      // this handles pinning
      u.over.addEventListener('click', (e) => {
        if (e.target === u.over) {
          if (e.ctrlKey || e.metaKey) {
            let xVal = u.posToVal(u.cursor.left!, 'x');

            selectedRange = {
              from: xVal,
              to: xVal,
            };

            scheduleRender(false);
          }
          // only pinnable tooltip is visible *and* is within proximity to series/point
          else if (_isHovering && closestSeriesIdx != null && !_isPinned) {
            _isPinned = true;
            scheduleRender(true);
          }
        }
      });
    });

    config.addHook('setSelect', (u) => {
      if (!viaSync && (clientZoom || queryZoom != null)) {
        if (maybeZoomAction(u.cursor!.event)) {
          if (clientZoom && yDrag) {
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
          } else if (queryZoom != null) {
            if (u.select.width >= MIN_ZOOM_DIST) {
              const minX = u.posToVal(u.select.left, 'x');
              const maxX = u.posToVal(u.select.left + u.select.width, 'x');

              queryZoom({ from: minX, to: maxX });

              yZoomed = false;
            }
          }
        } else {
          selectedRange = {
            from: u.posToVal(u.select.left!, 'x'),
            to: u.posToVal(u.select.left! + u.select.width, 'x'),
          };

          scheduleRender(true);
        }
      }

      // manually hide selected region (since cursor.drag.setScale = false)
      u.setSelect({ left: 0, width: 0, top: 0, height: 0 }, false);
    });

    if (clientZoom || queryZoom != null) {
      config.setCursor({
        bind: {
          dblclick: (u) => () => {
            if (!maybeZoomAction(u.cursor!.event)) {
              return null;
            }

            if (clientZoom && yZoomed) {
              for (let key in u.scales!) {
                if (key !== 'x') {
                  // @ts-ignore (this is not typed correctly in uPlot, assigning nulls means auto-scale / reset)
                  u.setScale(key, { min: null, max: null });
                }
              }

              yZoomed = false;
            } else if (queryZoom != null) {
              let xScale = u.scales.x;

              const frTs = xScale.min!;
              const toTs = xScale.max!;
              const pad = (toTs - frTs) / 2;

              queryZoom({ from: frTs - pad, to: toTs + pad });
            }

            return null;
          },
        },
      });
    }

    config.addHook('setData', (u) => {
      yZoomed = false;
      yDrag = false;
    });

    // fires on series focus/proximity changes
    // e.g. to highlight the hovered/closest series
    // TODO: we only need this for multi/all mode?
    config.addHook('setSeries', (u, seriesIdx) => {
      closestSeriesIdx = seriesIdx;

      viaSync = u.cursor.event == null;
      updateHovering();
      scheduleRender();
    });

    // fires on data value hovers/unhovers
    config.addHook('setLegend', (u) => {
      seriesIdxs = _plot?.cursor!.idxs!.slice()!;
      _someSeriesIdx = seriesIdxs.some((v, i) => i > 0 && v != null);

      viaSync = u.cursor.event == null;
      updateHovering();
      scheduleRender();
    });

    const scrollbarWidth = 16;
    let winWid = 0;
    let winHgt = 0;

    const updateWinSize = () => {
      _isHovering && !_isPinned && dismiss();

      winWid = window.innerWidth - scrollbarWidth;
      winHgt = window.innerHeight - scrollbarWidth;
    };

    const updatePlotVisible = () => {
      plotVisible =
        _plot!.rect.bottom <= winHgt && _plot!.rect.top >= 0 && _plot!.rect.left >= 0 && _plot!.rect.right <= winWid;
    };

    updateWinSize();
    config.addHook('ready', updatePlotVisible);

    // fires on mousemoves
    config.addHook('setCursor', (u) => {
      viaSync = u.cursor.event == null;

      if (!_isHovering) {
        return;
      }

      let { left = -10, top = -10 } = u.cursor;

      if (left >= 0 || top >= 0) {
        let clientX = u.rect.left + left;
        let clientY = u.rect.top + top;

        let transform = '';

        let { width, height } = sizeRef.current!;

        width += TOOLTIP_OFFSET;
        height += TOOLTIP_OFFSET;

        if (offsetY !== 0) {
          if (clientY + height < winHgt || clientY - height < 0) {
            offsetY = 0;
          } else if (offsetY !== -height) {
            offsetY = -height;
          }
        } else {
          if (clientY + height > winHgt && clientY - height >= 0) {
            offsetY = -height;
          }
        }

        if (offsetX !== 0) {
          if (clientX + width < winWid || clientX - width < 0) {
            offsetX = 0;
          } else if (offsetX !== -width) {
            offsetX = -width;
          }
        } else {
          if (clientX + width > winWid && clientX - width >= 0) {
            offsetX = -width;
          }
        }

        const shiftX = clientX + (offsetX === 0 ? TOOLTIP_OFFSET : -TOOLTIP_OFFSET);
        const shiftY = clientY + (offsetY === 0 ? TOOLTIP_OFFSET : -TOOLTIP_OFFSET);

        const reflectX = offsetX === 0 ? '' : 'translateX(-100%)';
        const reflectY = offsetY === 0 ? '' : 'translateY(-100%)';

        // TODO: to a transition only when switching sides
        // transition: transform 100ms;

        transform = `translateX(${shiftX}px) ${reflectX} translateY(${shiftY}px) ${reflectY}`;

        if (domRef.current != null) {
          domRef.current.style.transform = transform;
        } else {
          _style.transform = transform;
          scheduleRender();
        }
      }
    });

    const onscroll = () => {
      updatePlotVisible();
      _isHovering && !_isPinned && dismiss();
    };

    window.addEventListener('resize', updateWinSize);
    window.addEventListener('scroll', onscroll, true);

    return () => {
      window.removeEventListener('resize', updateWinSize);
      window.removeEventListener('scroll', onscroll, true);
    };
  }, [config]);

  useLayoutEffect(() => {
    const size = sizeRef.current!;

    if (domRef.current != null) {
      size.observer.observe(domRef.current);
    }
  }, [domRef.current]);

  if (plot && isHovering) {
    return createPortal(
      <div className={cx(styles.tooltipWrapper, isPinned && styles.pinned)} style={style} ref={domRef}>
        {isPinned && <CloseButton onClick={dismiss} />}
        {contents}
      </div>,
      portalRoot.current
    );
  }

  return null;
};

const getStyles = (theme: GrafanaTheme2, maxWidth?: number, maxHeight?: number) => ({
  tooltipWrapper: css({
    top: 0,
    left: 0,
    zIndex: theme.zIndex.tooltip,
    whiteSpace: 'pre',
    borderRadius: theme.shape.radius.default,
    position: 'absolute',
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z2,
    userSelect: 'text',
    maxWidth: maxWidth ?? 'none',
    maxHeight: maxHeight ?? 'none',
    overflowY: 'auto',
  }),
  pinned: css({
    boxShadow: theme.shadows.z3,
  }),
});
