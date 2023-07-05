import { css } from '@emotion/css';
import React, { useLayoutEffect, useRef, useState } from 'react';
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

/**
 * @alpha
 */
export const TooltipPlugin4 = ({ config, render }: TooltipPlugin4Props) => {
  const domRef = useRef<HTMLDivElement>(null);
  const [plot, setPlot] = useState<uPlot>();

  const styleRef = useRef({ transform: '', pointerEvents: 'none' }); // boo! // <CSSStyleDeclaration> ?
  const [isVisible, setVisible] = useState(false);
  const [isPinned, setPinned] = useState(false);

  const [contents, setContents] = useState<React.ReactNode>();

  const style = useStyles2(getStyles);

  useLayoutEffect(() => {
    let _isVisible = isVisible;
    let _isPinned = isPinned;

    let offsetX = 0;
    let offsetY = 0;
    let width = 0;
    let height = 0;

    let htmlEl = document.documentElement;
    let winWidth = htmlEl.clientWidth - 16;
    let winHeight = htmlEl.clientHeight - 16;

    let closestSeriesIdx: number | null = null;

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

    window.addEventListener('resize', (e) => {
      winWidth = htmlEl.clientWidth - 5;
      winHeight = htmlEl.clientHeight - 5;
    });

    config.addHook('init', (u) => {
      setPlot(u);

      // TODO: use cursor.lock & and mousedown/mouseup here (to prevent unlocking)
      u.over.addEventListener('click', (e) => {
        if (e.target === u.over) {
          setPinned((_isPinned = !_isPinned));
          styleRef.current = { ...styleRef.current, pointerEvents: _isPinned ? 'all' : 'none' };
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

    // fires on data value hovers/unhovers
    config.addHook('setLegend', (u) => {
      setContents(render(u, u.cursor.idxs!, closestSeriesIdx, _isPinned));
    });

    // fires on series focus/proximity changes
    // e.g. to highlight the hovered/closest series
    // TODO: we only need this for multi/all mode?
    config.addHook('setSeries', (u, seriesIdx) => {
      if (closestSeriesIdx !== seriesIdx) {
        setContents(render(u, u.cursor.idxs!, seriesIdx, _isPinned));
      }

      closestSeriesIdx = seriesIdx;
    });

    // fires on mousemoves
    config.addHook('setCursor', (u) => {
      let { left = -10, top = -10 } = u.cursor;

      if (left < 0 && top < 0) {
        if (_isVisible) {
          setVisible((_isVisible = false));

          // TODO: this should be done by Dashboards onmouseleave
          let ctnr = u.root.closest<HTMLElement>('.react-grid-item, .SplitPane');
          if (ctnr != null) {
            // panel edit
            if (ctnr.matches('.SplitPane')) {
              ctnr.style.overflow = 'hidden';
            }
            // dashboard grid
            else {
              ctnr.style.zIndex = 'auto';
            }
          }

          // prolly not needed since dom will be destroyed, so this should be GCd
          resizeObserver.unobserve(domRef.current!);
        }
      } else {
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

        if (_isVisible && domRef.current) {
          domRef.current.style.transform = transform;
        } else {
          styleRef.current = { ...styleRef.current, transform: transform };
          setVisible((_isVisible = true));

          // TODO: this should be done by Dashboards onmouseenter
          let ctnr = u.root.closest<HTMLElement>('.react-grid-item, .SplitPane');
          if (ctnr != null) {
            // panel edit
            if (ctnr.matches('.SplitPane')) {
              ctnr.style.overflow = '';
            }
            // dashboard grid
            else {
              ctnr.style.zIndex = '1';
            }
          }

          // boo setTimeout!
          setTimeout(() => {
            resizeObserver.observe(domRef.current!);
          }, 0);
        }
      }
    });
  }, [config]);

  if (plot && isVisible) {
    return createPortal(
      <div className={style.tooltipWrapper} style={styleRef.current} ref={domRef}>
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
