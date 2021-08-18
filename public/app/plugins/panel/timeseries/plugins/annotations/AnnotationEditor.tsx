import React, { useState } from 'react';
import { usePopper } from 'react-popper';
import { css, cx } from '@emotion/css';
import { PlotSelection, usePlotContext, useStyles2, useTheme2, Portal, DEFAULT_ANNOTATION_COLOR } from '@grafana/ui';
import { colorManipulator, DataFrame, getDisplayProcessor, GrafanaTheme2, TimeZone } from '@grafana/data';
import { getCommonAnnotationStyles } from '../styles';
import { AnnotationEditorForm } from './AnnotationEditorForm';

interface AnnotationEditorProps {
  data: DataFrame;
  timeZone: TimeZone;
  selection: PlotSelection;
  onSave: () => void;
  onDismiss: () => void;
  annotation?: AnnotationsDataFrameViewDTO;
}

export const AnnotationEditor: React.FC<AnnotationEditorProps> = ({
  onDismiss,
  onSave,
  timeZone,
  data,
  selection,
  annotation,
}) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const commonStyles = useStyles2(getCommonAnnotationStyles);
  const plotCtx = usePlotContext();
  const [popperTrigger, setPopperTrigger] = useState<HTMLDivElement | null>(null);
  const [editorPopover, setEditorPopover] = useState<HTMLDivElement | null>(null);

  const popper = usePopper(popperTrigger, editorPopover, {
    modifiers: [
      { name: 'arrow', enabled: false },
      {
        name: 'preventOverflow',
        enabled: true,
        options: {
          rootBoundary: 'viewport',
        },
      },
    ],
  });

  if (!plotCtx || !plotCtx.getCanvasBoundingBox()) {
    return null;
  }
  const canvasBbox = plotCtx.getCanvasBoundingBox();

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
          className={css`
            position: absolute;
            top: ${canvasBbox!.top}px;
            left: ${canvasBbox!.left}px;
            width: ${canvasBbox!.width}px;
            height: ${canvasBbox!.height}px;
          `}
        >
          <div // Annotation marker
            className={cx(
              css`
                position: absolute;
                top: ${selection.bbox.top}px;
                left: ${selection.bbox.left}px;
                width: ${selection.bbox.width}px;
                height: ${selection.bbox.height}px;
              `,
              isRegionAnnotation ? styles.overlayRange(annotation) : styles.overlay(annotation)
            )}
          >
            <div
              ref={setPopperTrigger}
              className={
                isRegionAnnotation
                  ? cx(commonStyles(annotation).markerBar, styles.markerBar)
                  : cx(commonStyles(annotation).markerTriangle, styles.markerTriangle)
              }
            />
          </div>
        </div>

        <AnnotationEditorForm
          annotation={annotation || ({ time: selection.min, timeEnd: selection.max } as AnnotationsDataFrameViewDTO)}
          timeFormatter={(v) => xFieldFmt(v).text}
          onSave={onSave}
          onDismiss={onDismiss}
          ref={setEditorPopover}
          style={popper.styles.popper}
          {...popper.attributes.popper}
        />
      </>
    </Portal>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    overlay: (annotation?: AnnotationsDataFrameViewDTO) => {
      const color = theme.visualization.getColorByName(annotation?.color || DEFAULT_ANNOTATION_COLOR);
      return css`
        border-left: 1px dashed ${color};
      `;
    },
    overlayRange: (annotation?: AnnotationsDataFrameViewDTO) => {
      const color = theme.visualization.getColorByName(annotation?.color || DEFAULT_ANNOTATION_COLOR);
      return css`
        background: ${colorManipulator.alpha(color, 0.1)};
        border-left: 1px dashed ${color};
        border-right: 1px dashed ${color};
      `;
    },
    markerTriangle: css`
      top: calc(100% + 2px);
      left: -4px;
      position: absolute;
    `,
    markerBar: css`
      top: 100%;
      left: 0;
      position: absolute;
    `,
  };
};
