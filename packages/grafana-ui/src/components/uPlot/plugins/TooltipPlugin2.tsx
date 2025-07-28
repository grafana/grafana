import { css, cx } from '@emotion/css';
import { useLayoutEffect, useRef, useReducer, CSSProperties } from 'react';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { AdHocFilterModel } from 'src/components/VizTooltip/VizTooltipFooter';
import uPlot from 'uplot';

import { GrafanaTheme2, LinkModel } from '@grafana/data';
import { DashboardCursorSync } from '@grafana/schema';

import { useStyles2 } from '../../../themes/ThemeContext';
import { RangeSelection1D, RangeSelection2D, OnSelectRangeCallback } from '../../PanelChrome';
import { getPortalContainer } from '../../Portal/Portal';
import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

import { CloseButton } from './CloseButton';

export const DEFAULT_TOOLTIP_WIDTH = undefined;
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

type GetDataLinksCallback = (seriesIdx: number, dataIdx: number) => LinkModel[];
type GetAdHocFiltersCallback = (seriesIdx: number, dataIdx: number) => AdHocFilterModel[];

interface TooltipPlugin2Props {
  config: UPlotConfigBuilder;
  hoverMode: TooltipHoverMode;

  syncMode?: DashboardCursorSync;
  syncScope?: string;

  // x only
  queryZoom?: (range: { from: number; to: number }) => void;
  // y-only, via shiftKey
  clientZoom?: boolean;

  onSelectRange?: OnSelectRangeCallback;
  getDataLinks?: GetDataLinksCallback;
  getAdHocFilters?: GetAdHocFiltersCallback;

  render: (
    u: uPlot,
    dataIdxs: Array<number | null>,
    seriesIdx: number | null,
    isPinned: boolean,
    dismiss: () => void,
    // selected time range (for annotation triggering)
    timeRange: TimeRange2 | null,
    viaSync: boolean,
    dataLinks: LinkModel[],
    adHocFilters: AdHocFilterModel[],
  ) => React.ReactNode;

  maxWidth?: number;
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

const getDataLinksFallback: GetDataLinksCallback = () => [];
const getAdHocFiltersFallback: GetAdHocFiltersCallback = () => [];

const userAgentIsMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

/**
 * @alpha
 */
export const TooltipPlugin2 = ({
  config,
  hoverMode,
  render,
  clientZoom = false,
  queryZoom,
  onSelectRange,
  maxWidth,
  syncMode = DashboardCursorSync.Off,
  syncScope = 'global', // eventsScope
  getDataLinks = getDataLinksFallback,
  getAdHocFilters = getAdHocFiltersFallback,
}: TooltipPlugin2Props) => {
  const domRef = useRef<HTMLDivElement>(null);
  const portalRoot = useRef<HTMLElement | null>(null);

  if (portalRoot.current == null) {
    portalRoot.current = getPortalContainer();
  }

  const [{ plot, isHovering, isPinned, contents, style, dismiss }, setState] = useReducer(mergeState, null, initState);

  const sizeRef = useRef<TooltipContainerSize>();
  const styles = useStyles2(getStyles, maxWidth);

  const renderRef = useRef(render);
  renderRef.current = render;

  const getLinksRef = useRef(getDataLinks);
  getLinksRef.current = getDataLinks;

  const getAdHocFiltersRef = useRef(getAdHocFilters);
  getAdHocFiltersRef.current = getAdHocFilters;

  useLayoutEffect(() => {
    sizeRef.current?.observer.disconnect();

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

    const syncTooltip = syncMode === DashboardCursorSync.Tooltip;

    if (syncMode !== DashboardCursorSync.Off && config.scales[0].props.isTime) {
      config.setCursor({
        sync: {
          key: syncScope,
          scales: ['x', null],
        },
      });
    }

    const updateHovering = () => {
      if (viaSync) {
        _isHovering = plotVisible && _someSeriesIdx && syncTooltip;
      } else {
        _isHovering = closestSeriesIdx != null || (hoverMode === TooltipHoverMode.xAll && _someSeriesIdx);
      }
    };

    let offsetX = 0;
    let offsetY = 0;

    let selectedRange: TimeRange2 | null = null;
    let seriesIdxs: Array<number | null> = [];
    let closestSeriesIdx: number | null = null;
    let viaSync = false;
    let dataLinks: LinkModel[] = [];
    let adHocFilters: AdHocFilterModel[] = [];

    // for onceClick link rendering during mousemoves we use these pre-generated first links or actions
    // these will be wrong if the titles have interpolation using the hovered *value*
    // but this should be quite rare. we'll fix it if someone actually encounters this
    let persistentLinks: LinkModel[][] = [];

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
      // this tooltip is Portaled, but actions inside it create forms in Modals
      const isModalOrPortaled = '[role="dialog"], #grafana-portal-container';

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      if ((e.target as HTMLElement).closest(isModalOrPortaled) == null) {
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
            ? renderRef.current(
                _plot!,
                seriesIdxs,
                closestSeriesIdx,
                _isPinned,
                dismiss,
                selectedRange,
                viaSync,
                _isPinned ? dataLinks : closestSeriesIdx != null ? persistentLinks[closestSeriesIdx] : [],
                _isPinned ? adHocFilters : [],
              )
            : null,
        dismiss,
      };

      setState(state);

      // TODO: set u.over.style.cursor = 'pointer' if we hovered a oneClick point
      // else revert to default...but only when the new pointer is different from prev

      selectedRange = null;
    };

    const dismiss = () => {
      let prevIsPinned = _isPinned;
      _isPinned = false;
      _isHovering = false;
      _plot!.setCursor({ left: -10, top: -10 });
      dataLinks = [];
      adHocFilters = [];

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

      // this handles pinning, 0-width range selection, and one-click
      u.over.addEventListener('click', (e) => {
        if (e.target === u.over) {
          if (e.ctrlKey || e.metaKey) {
            let xVal;

            const isXAxisHorizontal = u.scales.x.ori === 0;
            if (isXAxisHorizontal) {
              xVal = u.posToVal(u.cursor.left!, 'x');
            } else {
              xVal = u.posToVal(u.select.top + u.select.height, 'x');
            }

            selectedRange = {
              from: xVal,
              to: xVal,
            };

            scheduleRender(false);
          }
          // if tooltip visible, not pinned, and within proximity to a series/point
          else if (_isHovering && !_isPinned && closestSeriesIdx != null) {
            dataLinks = getLinksRef.current(closestSeriesIdx, seriesIdxs[closestSeriesIdx]!);
            adHocFilters = getAdHocFiltersRef.current(closestSeriesIdx, seriesIdxs[closestSeriesIdx]!);
            const oneClickLink = dataLinks.find((dataLink) => dataLink.oneClick === true);

            if (oneClickLink != null) {
              window.open(oneClickLink.href, oneClickLink.target ?? '_self');
            } else {
              setTimeout(() => {
                _isPinned = true;
                scheduleRender(true);
              }, 0);
            }
          }
        }
      });
    });

    config.addHook('setSelect', (u) => {
      const isXAxisHorizontal = u.scales.x.ori === 0;

      if (!viaSync && (clientZoom || queryZoom != null)) {
        if (maybeZoomAction(u.cursor!.event)) {
          if (onSelectRange != null) {
            let selections: RangeSelection2D[] = [];

            const yDrag = Boolean(u.cursor!.drag!.y);
            const xDrag = Boolean(u.cursor!.drag!.x);

            let xSel = null;
            let ySels: RangeSelection1D[] = [];

            // get x selection
            if (xDrag) {
              xSel = {
                from: isXAxisHorizontal
                  ? u.posToVal(u.select.left!, 'x')
                  : u.posToVal(u.select.top + u.select.height, 'x'),
                to: isXAxisHorizontal
                  ? u.posToVal(u.select.left! + u.select.width, 'x')
                  : u.posToVal(u.select.top, 'x'),
              };
            }

            // get y selections
            if (yDrag) {
              config.scales.forEach((scale) => {
                const key = scale.props.scaleKey;

                if (key !== 'x') {
                  let ySel = {
                    from: isXAxisHorizontal
                      ? u.posToVal(u.select.top + u.select.height, key)
                      : u.posToVal(u.select.left + u.select.width, key),
                    to: isXAxisHorizontal ? u.posToVal(u.select.top, key) : u.posToVal(u.select.left, key),
                  };

                  ySels.push(ySel);
                }
              });
            }

            if (xDrag) {
              if (yDrag) {
                // x + y
                selections = ySels.map((ySel) => ({ x: xSel!, y: ySel }));
              } else {
                // x only
                selections = [{ x: xSel! }];
              }
            } else {
              if (yDrag) {
                // y only
                selections = ySels.map((ySel) => ({ y: ySel }));
              }
            }

            onSelectRange(selections);
          } else if (clientZoom && yDrag) {
            if (u.select.height >= MIN_ZOOM_DIST) {
              for (let key in u.scales!) {
                if (key !== 'x') {
                  const maxY = isXAxisHorizontal
                    ? u.posToVal(u.select.top, key)
                    : u.posToVal(u.select.left + u.select.width, key);
                  const minY = isXAxisHorizontal
                    ? u.posToVal(u.select.top + u.select.height, key)
                    : u.posToVal(u.select.left, key);

                  u.setScale(key, { min: minY, max: maxY });
                }
              }

              yZoomed = true;
            }

            yDrag = false;
          } else if (queryZoom != null) {
            if (u.select.width >= MIN_ZOOM_DIST) {
              const minX = isXAxisHorizontal
                ? u.posToVal(u.select.left, 'x')
                : u.posToVal(u.select.top + u.select.height, 'x');
              const maxX = isXAxisHorizontal
                ? u.posToVal(u.select.left + u.select.width, 'x')
                : u.posToVal(u.select.top, 'x');

              queryZoom({ from: minX, to: maxX });

              yZoomed = false;
            }
          }
        } else {
          selectedRange = {
            from: isXAxisHorizontal ? u.posToVal(u.select.left!, 'x') : u.posToVal(u.select.top + u.select.height, 'x'),
            to: isXAxisHorizontal ? u.posToVal(u.select.left! + u.select.width, 'x') : u.posToVal(u.select.top, 'x'),
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

      if (_isPinned) {
        dismiss();
      }
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

      if (persistentLinks.length === 0) {
        persistentLinks = seriesIdxs.map((v, seriesIdx) => {
          if (seriesIdx > 0) {
            const links = getDataLinks(seriesIdx, seriesIdxs[seriesIdx]!);
            const oneClickLink = links.find((dataLink) => dataLink.oneClick === true);

            if (oneClickLink) {
              return [oneClickLink];
            }
          }

          return [];
        });
      }

      viaSync = u.cursor.event == null;
      let prevIsHovering = _isHovering;
      updateHovering();

      if (_isHovering || _isHovering !== prevIsHovering) {
        scheduleRender();
      }
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

    const onscroll = (e: Event) => {
      updatePlotVisible();
      _isHovering && e.target instanceof Node && e.target.contains(_plot!.root) && dismiss();
    };

    window.addEventListener('resize', updateWinSize);
    window.addEventListener('scroll', onscroll, true);

    return () => {
      sizeRef.current?.observer.disconnect();

      window.removeEventListener('resize', updateWinSize);
      window.removeEventListener('scroll', onscroll, true);

      // in case this component unmounts while anchored (due to data auto-refresh + re-config)
      document.removeEventListener('mousedown', downEventOutside, true);
      document.removeEventListener('keydown', downEventOutside, true);
    };
  }, [config]);

  useLayoutEffect(() => {
    const size = sizeRef.current!;

    if (domRef.current != null) {
      size.observer.disconnect();
      size.observer.observe(domRef.current);

      // since the above observer is attached after container is in DOM, we need to manually update sizeRef
      // and re-trigger a cursor move to do initial positioning math
      const { width, height } = domRef.current.getBoundingClientRect();
      size.width = width;
      size.height = height;

      let event = plot!.cursor.event;

      // if not viaSync, re-dispatch real event
      if (event != null) {
        // we expect to re-dispatch mousemove, but may have a different event type, so create a mousemove event and fire that instead
        // this doesn't work for every mobile device, so fall back to checking the useragent as well
        const isMobile = event.type !== 'mousemove' || userAgentIsMobile;

        if (isMobile) {
          event = new MouseEvent('mousemove', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: event.clientX,
            clientY: event.clientY,
            screenX: event.screenX,
            screenY: event.screenY,
          });
        }

        // this works around the fact that uPlot does not unset cursor.event (for perf reasons)
        // so if the last real mouse event was mouseleave and you manually trigger u.setCursor()
        // it would end up re-dispatching mouseleave
        const isStaleEvent = isMobile ? false : performance.now() - event.timeStamp > 16;

        !isStaleEvent && plot!.over.dispatchEvent(event);
      } else {
        plot!.setCursor(
          {
            left: plot!.cursor.left!,
            top: plot!.cursor.top!,
          },
          true
        );
      }
    } else {
      size.width = 0;
      size.height = 0;
    }
  }, [isHovering]);

  if (plot && isHovering) {
    return createPortal(
      <div
        className={cx(styles.tooltipWrapper, isPinned && styles.pinned)}
        style={style}
        aria-live="polite"
        aria-atomic="true"
        ref={domRef}
      >
        {isPinned && <CloseButton onClick={dismiss} />}
        {contents}
      </div>,
      portalRoot.current
    );
  }

  return null;
};

const getStyles = (theme: GrafanaTheme2, maxWidth?: number) => ({
  tooltipWrapper: css({
    top: 0,
    left: 0,
    zIndex: theme.zIndex.portal,
    whiteSpace: 'pre',
    borderRadius: theme.shape.radius.default,
    position: 'fixed',
    background: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z2,
    userSelect: 'text',
    maxWidth: maxWidth ?? 'none',
  }),
  pinned: css({
    boxShadow: theme.shadows.z3,
  }),
});
