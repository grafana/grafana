import React, { useLayoutEffect } from 'react';
import uPlot from 'uplot';

import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

interface BarHighlightPluginProps {
  config: UPlotConfigBuilder;
  className?: string;
}

/**
 * @alpha
 */
export const BarHighlightPlugin: React.FC<BarHighlightPluginProps> = ({ config, className }) => {
  let underEl, overEl, highlightEl: HTMLDivElement, currIdx: number | null | undefined;

  useLayoutEffect(() => {
    config.addHook('init', (u) => {
      underEl = u.under;
      overEl = u.over;

      highlightEl = document.createElement('div');

      className && highlightEl.classList.add(className);

      uPlot.assign(highlightEl.style, {
        pointerEvents: 'none',
        display: 'none',
        position: 'absolute',
        left: 0,
        top: 0,
        height: '100%',
        backgroundColor: 'rgba(236,236,236,0.3)',
      });

      underEl.appendChild(highlightEl);

      // show/hide highlight on enter/exit
      // @ts-ignore
      overEl.addEventListener('mouseenter', () => {
        highlightEl.style.display = null;
      });
      overEl.addEventListener('mouseleave', () => {
        highlightEl.style.display = 'none';
      });
    });

    config.addHook('setCursor', (u) => {
      if (currIdx !== u.cursor.idx) {
        currIdx = u.cursor.idx;

        if (currIdx === undefined || currIdx === null || u.series[0].idxs === undefined) {
          return;
        }

        let [iMin, iMax] = u.series[0].idxs;

        const dx = ++iMax - iMin;
        const width = u.bbox.width / dx / devicePixelRatio;
        const xVal = u.scales.x.distr === 2 ? currIdx : u.data[0][currIdx];
        const left = u.valToPos(xVal, 'x') - width / 2;

        highlightEl.style.transform = 'translateX(' + Math.round(left) + 'px)';
        highlightEl.style.width = Math.round(width) + 'px';
      }
    });
  }, [config]);

  return null;
};
