import { css } from '@emotion/css';
import React, { useLayoutEffect, useRef, useState, useReducer, CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import uPlot from 'uplot';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';
import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

interface TooltipPlugin4Props {
  config: UPlotConfigBuilder;
  // or via .children() render prop callback?
  render: (u: uPlot, dataIdxs: Array<number | null>, seriesIdx?: number | null, isPinned?: boolean) => React.ReactNode;
}

interface TooltipContainerState {
  plot?: uPlot | null;
  style: Partial<CSSProperties>;
  isHovering: boolean;
  isPinned: boolean;
  contents?: React.ReactNode;
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
};

/**
 * @alpha
 */
export const TooltipPlugin4 = ({ config, render }: TooltipPlugin4Props) => {
  const domRef = useRef<HTMLDivElement>(null);

  const [{ plot, isHovering, isPinned, contents, style }, setState] = useReducer(mergeState, INITIAL_STATE);

  const className = useStyles2(getStyles).tooltipWrapper;

  useLayoutEffect(() => {
    let _plot = plot;
    let _isHovering = isHovering;
    let _isPinned = isPinned;
    let _style = style;

    let offsetX = 0;
    let offsetY = 0;
    let width = 0;
    let height = 0;

    let htmlEl = document.documentElement;
    let winWidth = htmlEl.clientWidth - 16;
    let winHeight = htmlEl.clientHeight - 16;

    window.addEventListener('resize', (e) => {
      winWidth = htmlEl.clientWidth - 5;
      winHeight = htmlEl.clientHeight - 5;
    });

    let closestSeriesIdx: number | null = null;

    let pendingRender = false;

    const scheduleRender = () => {
      if (!pendingRender) {
        pendingRender = true;
        queueMicrotask(_render);
      }
    }

    const _render = () => {
      pendingRender = false;

      let state: TooltipContainerState = {
        style: _style,
        isPinned: _isPinned,
        isHovering: _isHovering,
        contents: _isHovering ? render(_plot!, _plot!.cursor.idxs!, closestSeriesIdx, _isPinned) : null,
      };

      setState(state);
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.borderBoxSize?.length > 0) {
          width = entry.borderBoxSize[0].inlineSize;
          height = entry.borderBoxSize[0].blockSize;
        } else {
          width = entry.contentRect.width;
          height = entry.contentRect.width;
        }
      }
    });

    config.addHook('init', (u) => {
      setState({ plot: (_plot = u) });

      // TODO: use cursor.lock & and mousedown/mouseup here (to prevent unlocking)
      u.over.addEventListener('click', (e) => {
        if (e.target === u.over) {
          _isPinned = !_isPinned;
          _style = { pointerEvents: _isPinned ? 'all' : 'none' };
          scheduleRender();
        }

        // @ts-ignore
        u.cursor._lock = _isPinned;

        // hack to trigger cursor to new position after unlock
        // (should not be necessary after using the cursor.lock API)
        if (!_isPinned) {
          u.setCursor({ left: e.clientX - u.rect.left, top: e.clientY - u.rect.top });
        }
      });
    });

    // fires on data value hovers/unhovers (before setSeries)
    config.addHook('setLegend', (u) => {
      let _isHoveringNow = _plot!.cursor.idxs!.some(v => v != null);

      if (_isHoveringNow) {
        // create
        if (!_isHovering) {
          // boo setTimeout!
          setTimeout(() => {
            resizeObserver.observe(domRef.current!);
          }, 200);

          _isHovering = true;
        }
      } else {
        // destroy...TODO: debounce this
        if (_isHovering) {
          // prolly not needed since dom will be destroyed, so this should be GCd
          resizeObserver.unobserve(domRef.current!);

          _isHovering = false;
        }
      }

      // scheduleHide (debounce when hovering all-nulls), scheduleShow, scheduleUpdate
      scheduleRender();
    });

    // fires on series focus/proximity changes
    // e.g. to highlight the hovered/closest series
    // TODO: we only need this for multi/all mode?
    config.addHook('setSeries', (u, seriesIdx) => {
      // don't jiggle focused series styling when there's only one series
      const isMultiSeries = u.series.length > 2;

      if (isMultiSeries && closestSeriesIdx !== seriesIdx) {
        closestSeriesIdx = seriesIdx;
        scheduleRender();
      }
    });

    // fires on mousemoves
    config.addHook('setCursor', (u) => {
      let { left = -10, top = -10 } = u.cursor;

      if (left >= 0 || top >= 0) {
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
          if (domRef.current) {
            domRef.current.style.transform = transform;
          } else {
            _style.transform = transform;
            scheduleRender();
          }
        }
      }
    });
  }, [config]);

  if (plot && isHovering) {
    return createPortal(
      <div className={className} style={style} ref={domRef}>
        <div>{isPinned ? '!!PINNED!! [X]' : ''}</div>
        {contents}
      </div>,
      plot.over
    );
  }

  return null;
};

const getStyles = (theme: GrafanaTheme2) => ({
  tooltipWrapper: css`
    background: ${theme.colors.background.secondary};
    top: 0;
    left: 0;
    position: absolute;
    z-index: 1;

    padding: 10px;
    white-space: pre;
  `,
});
