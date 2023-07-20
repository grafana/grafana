import { css } from '@emotion/css';
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { TimeZone } from '@grafana/schema';
import { UPlotConfigBuilder, useStyles2, PlotSelection } from '@grafana/ui';

import { AnnotationEditor2 } from './annotations/AnnotationEditor2';

interface AnnotationXEditorPluginProps {
  builder: UPlotConfigBuilder;
  timeRange?: { from: number; to: number } | null;
  timeZone: TimeZone;
  data: DataFrame;
}

/**
 * @alpha
 */
export const AnnotationXEditorPlugin = ({ builder, timeRange, data, timeZone }: AnnotationXEditorPluginProps) => {
  // set ref here?

  const domRef = useRef<HTMLDivElement>(null);
  const [plot, setPlot] = useState<uPlot>();
  const [selection, setSelection] = useState<PlotSelection | null>(null);
  const [isAddingAnnotation, setIsAddingAnnotation] = useState(false);

  const [, forceRender] = useState(Math.random());

  const styles = useStyles2(getStyles);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setIsAddingAnnotation(false);

    if (plot) {
      plot.setSelect({ top: 0, left: 0, width: 0, height: 0 });
    }
  }, [setIsAddingAnnotation, setSelection, plot]);

  useLayoutEffect(() => {
    let _plot: uPlot;

    builder.addHook('init', (u) => {
      setPlot((_plot = u));
    });

    builder.addHook('setSelect', (u) => {
      if (u.cursor.event?.ctrlKey || u.cursor.event?.metaKey) {
        setIsAddingAnnotation(true);
        setSelection({
          min: u.posToVal(u.select.left, 'x'),
          max: u.posToVal(u.select.left + u.select.width, 'x'),
          bbox: {
            left: u.select.left,
            top: 0,
            height: u.select.height,
            width: u.select.width,
          },
        });

        u.over.querySelector<HTMLDivElement>('.u-select')!.classList.add(styles.overlay);
        forceRender(Math.random());
      }
    });
  }, [builder, styles.overlay]);

  if (plot && plot.select.width > 0 && isAddingAnnotation) {
    // && timeRange
    return createPortal(
      <div
        ref={domRef}
        className={styles.editor}
        style={{
          left: `${plot.select.left + plot.select.width / 2}px`,
        }}
      >
        {isAddingAnnotation && selection && (
          <AnnotationEditor2
            selection={selection}
            timeZone={timeZone}
            data={data}
            onDismiss={clearSelection}
            onSave={clearSelection}
          />
        )}
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
    zIndex: 999,
  }),
  overlay: css({
    background: 'rgba(0, 211, 255, 0.1)',
    borderLeft: '1px dashed rgb(0, 211, 255)',
    borderRight: '1px dashed rgb(0, 211, 255)',
    borderBottom: '5px solid rgb(0, 211, 255)',

    // height: '100% !important', // todo: uPlot should do this
  }),
});
