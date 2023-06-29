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
  const domRef = useRef<HTMLPreElement>(null);
  const [plot, setPlot] = useState<uPlot>();

  const styleRef = useRef({ transform: '' }); // boo!
  const visRef = useRef(false);
  const [, forceRedraw] = useState(0);

  const [contents, setContents] = useState(getRandomContent);

  const style = useStyles2(getStyles);

  useLayoutEffect(() => {
    config.addHook('init', (u) => {
      setPlot(u);
    });

    config.addHook('setCursor', (u) => {
      let { left = -10, top = -10 } = u.cursor;

      if (left < 0 && top < 0) {
        if (visRef.current) {
          visRef.current = false;
          forceRedraw(Math.random());
        }
      } else {
        const transform = `translate(${left}px, ${top}px)`;

        if (visRef.current && domRef.current) {
          domRef.current.style.transform = transform;
        } else {
          styleRef.current.transform = transform;
          visRef.current = true;
          forceRedraw(Math.random());
        }
      }
    });

    config.addHook('setLegend', (u) => {
      setContents(getRandomContent());
    });
  }, [config]);

  if (plot && visRef.current) {
    return createPortal(
      <pre className={style.tooltipWrapper} style={styleRef.current} ref={domRef}>
        {contents}
      </pre>,
      plot.over
    );
  }

  return null;
};

const getStyles = (theme: GrafanaTheme2) => ({
  tooltipWrapper: css`
    min-width: 100px;
    min-height: 10px;
    background: ${theme.colors.background.secondary};
    top: 0;
    left: 0;
    pointer-events: none;
    position: absolute;
  `,
});
