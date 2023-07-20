import { css } from '@emotion/css';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { TimeZone } from '@grafana/schema';
import { UPlotConfigBuilder, useStyles2 } from '@grafana/ui';

interface AnnotationXEditorPluginProps {
  builder: UPlotConfigBuilder;
  timeRange?: { from: number; to: number } | null;
  timeZone: TimeZone;
}

/**
 * @alpha
 */
export const AnnotationXEditorPlugin = ({ builder, timeRange }: AnnotationXEditorPluginProps) => {
  // set ref here?

  const domRef = useRef<HTMLDivElement>(null);
  const [plot, setPlot] = useState<uPlot>();

  const [, forceRender] = useState(Math.random());

  const styles = useStyles2(getStyles);

  useLayoutEffect(() => {
    let _plot: uPlot;

    builder.addHook('init', (u) => {
      setPlot((_plot = u));
    });

    builder.addHook('setSelect', (u) => {
      if (u.cursor.event?.ctrlKey) {
        u.over.querySelector<HTMLDivElement>('.u-select')!.classList.add(styles.overlay);
        forceRender(Math.random());
      }
    });
  }, [builder]);

  if (plot && plot.select.width > 0) {
    // && timeRange
    return createPortal(
      <div
        ref={domRef}
        className={styles.editor}
        style={{
          left: `${plot.select.left + plot.select.width / 2}px`,
        }}
      >
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore
        magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
        consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum
      </div>,
      plot.over
    );
  }

  return null;
};

const getStyles = (theme: GrafanaTheme2) => ({
  editor: css({
    position: 'absolute',
    top: '100%',
    width: `300px`,
    padding: `8px`,
    transform: 'translateX(-50%)',
    borderRadius: '6px',
    background: theme.colors.background.secondary,
    boxShadow: `0 4px 8px ${theme.colors.background.primary}`,
  }),
  overlay: css({
    background: 'rgba(0, 211, 255, 0.1)',
    borderLeft: '1px dashed rgb(0, 211, 255)',
    borderRight: '1px dashed rgb(0, 211, 255)',
    borderBottom: '5px solid rgb(0, 211, 255)',

    // height: '100% !important', // todo: uPlot should do this
  })
});
