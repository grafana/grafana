import { css } from '@emotion/css';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import uPlot from 'uplot';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';
import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

import { getRandomContent } from './utils';

interface TooltipPlugin4Props {
  config: UPlotConfigBuilder;
}

/**
 * @alpha
 */
export const TooltipPlugin4 = ({ config }: TooltipPlugin4Props) => {
  const domRef = useRef<HTMLDivElement>(null);
  const [plot, setPlot] = useState<uPlot>();

  const styleRef = useRef({ transform: '' }); // boo!
  const [isVisible, setVisible] = useState(false);

  const [contents, setContents] = useState(getRandomContent);

  const style = useStyles2(getStyles);

  useLayoutEffect(() => {
    let _isVisible = isVisible;

    config.addHook('init', (u) => {
      setPlot(u);
    });

    config.addHook('setCursor', (u) => {
      let { left = -10, top = -10 } = u.cursor;

      if (left < 0 && top < 0) {
        if (_isVisible) {
          setVisible((_isVisible = false));

          // TODO: this should be done by Dashboards onmouseleave
          u.root.closest('.react-grid-item')!.style.zIndex = "auto";
        }
      } else {
        const transform = `translate(${left}px, ${top}px)`;

        if (_isVisible && domRef.current) {
          domRef.current.style.transform = transform;
        } else {
          styleRef.current = { ...styleRef.current, transform: transform };
          setVisible((_isVisible = true));

          // TODO: this should be done by Dashboards onmouseenter
          u.root.closest('.react-grid-item')!.style.zIndex = "1";
        }
      }
    });

    config.addHook('setLegend', (u) => {
      setContents(getRandomContent());
    });
  }, [config]);

  if (plot && isVisible) {
    return createPortal(
      <div className={style.tooltipWrapper} style={styleRef.current} ref={domRef}>
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
    pointer-events: none;
    position: absolute;
    z-index: 1;

    padding: 10px;
    white-space: pre;
  `,
});
