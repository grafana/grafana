import { css, cx } from '@emotion/css';
import { autoUpdate, flip, shift, useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import React, { HTMLAttributes } from 'react';

import { colorManipulator, DataFrame, getDisplayProcessor, GrafanaTheme2, TimeZone } from '@grafana/data';
import { PlotSelection, useStyles2, useTheme2, Portal, DEFAULT_ANNOTATION_COLOR } from '@grafana/ui';

import { getCommonAnnotationStyles } from '../styles';
import { AnnotationsDataFrameViewDTO } from '../types';

import { AnnotationEditorForm } from './AnnotationEditorForm';

interface AnnotationEditorProps extends HTMLAttributes<HTMLDivElement> {
  data: DataFrame;
  timeZone: TimeZone;
  selection: PlotSelection;
  onSave: () => void;
  onDismiss: () => void;
  annotation?: AnnotationsDataFrameViewDTO;
}

export const AnnotationEditor = ({
  onDismiss,
  onSave,
  timeZone,
  data,
  selection,
  annotation,
  style,
}: AnnotationEditorProps) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const commonStyles = useStyles2(getCommonAnnotationStyles);

  // the order of middleware is important!
  const middleware = [
    flip({
      fallbackAxisSideDirection: 'end',
      // see https://floating-ui.com/docs/flip#combining-with-shift
      crossAxis: false,
      boundary: document.body,
    }),
    shift(),
  ];

  const { context, refs, floatingStyles } = useFloating({
    open: true,
    placement: 'bottom',
    onOpenChange: (open) => {
      if (!open) {
        onDismiss();
      }
    },
    middleware,
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  const dismiss = useDismiss(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

  let xField = data.fields[0];
  if (!xField) {
    return null;
  }
  const xFieldFmt = xField.display || getDisplayProcessor({ field: xField, timeZone, theme });
  const isRegionAnnotation = selection.min !== selection.max;

  return (
    <Portal>
      <>
        <div // div overlay matching uPlot canvas bbox
          style={style}
        >
          <div // Annotation marker
            className={cx(
              css({
                position: 'absolute',
                top: selection.bbox.top,
                left: selection.bbox.left,
                width: selection.bbox.width,
                height: selection.bbox.height,
              }),
              isRegionAnnotation ? styles.overlayRange(annotation) : styles.overlay(annotation)
            )}
          >
            <div
              ref={refs.setReference}
              className={
                isRegionAnnotation
                  ? cx(commonStyles(annotation).markerBar, styles.markerBar)
                  : cx(commonStyles(annotation).markerTriangle, styles.markerTriangle)
              }
              {...getReferenceProps()}
            />
          </div>
        </div>

        <AnnotationEditorForm
          annotation={annotation || ({ time: selection.min, timeEnd: selection.max } as AnnotationsDataFrameViewDTO)}
          timeFormatter={(v) => xFieldFmt(v).text}
          onSave={onSave}
          onDismiss={onDismiss}
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps()}
        />
      </>
    </Portal>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    overlay: (annotation?: AnnotationsDataFrameViewDTO) => {
      const color = theme.visualization.getColorByName(annotation?.color || DEFAULT_ANNOTATION_COLOR);
      return css({
        borderLeft: `1px dashed ${color}`,
      });
    },
    overlayRange: (annotation?: AnnotationsDataFrameViewDTO) => {
      const color = theme.visualization.getColorByName(annotation?.color || DEFAULT_ANNOTATION_COLOR);
      return css({
        background: colorManipulator.alpha(color, 0.1),
        borderLeft: `1px dashed ${color}`,
        borderRight: `1px dashed ${color}`,
      });
    },
    markerTriangle: css({
      top: `calc(100% + 2px)`,
      left: '-4px',
      position: 'absolute',
    }),
    markerBar: css({
      top: '100%',
      left: 0,
      position: 'absolute',
    }),
  };
};
