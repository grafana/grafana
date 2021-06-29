import React, { useState, useRef, ChangeEvent, HTMLAttributes } from 'react';
import useClickAway from 'react-use/lib/useClickAway';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { css, cx } from '@emotion/css';
import {
  Button,
  Field,
  HorizontalGroup,
  PlotSelection,
  TagsInput,
  TextArea,
  usePlotContext,
  useStyles2,
  useTheme2,
  Portal,
  usePanelContext,
  DEFAULT_ANNOTATION_COLOR,
} from '@grafana/ui';
import {
  AnnotationEventUIModel,
  colorManipulator,
  DataFrame,
  getDisplayProcessor,
  GrafanaTheme2,
  TimeZone,
} from '@grafana/data';
import { getCommonAnnotationStyles } from './styles';

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
  const ref = useRef(null);
  const plotCtx = usePlotContext();

  useClickAway(ref, () => {
    onDismiss();
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
          ref={ref}
          className={css`
            position: absolute;
            top: ${canvasBbox!.top + selection.bbox.top + canvasBbox!.height + 9}px;
            left: ${canvasBbox!.left + selection.bbox.left}px;
            transform: translate3d(-50%, 0, 0);
          `}
        />
      </>
    </Portal>
  );
};

interface AnnotationEditorFormProps extends HTMLAttributes<HTMLDivElement> {
  annotation: AnnotationsDataFrameViewDTO;
  timeFormatter: (v: number) => string;
  onSave?: () => void;
  onDismiss?: () => void;
}

export const AnnotationEditorForm = React.forwardRef<HTMLDivElement, AnnotationEditorFormProps>(
  ({ annotation, onSave, onDismiss, timeFormatter, className }, ref) => {
    const styles = useStyles2(getStyles);
    const [description, setDescription] = useState<string>(annotation?.text || '');
    const [tags, setTags] = useState<string[]>(annotation?.tags || []);
    const panelContext = usePanelContext();

    const [createAnnotationState, createAnnotation] = useAsyncFn(async (event: AnnotationEventUIModel) => {
      const result = await panelContext.createAnnotation!(event);
      if (onSave) {
        onSave();
      }
      return result;
    });

    const [updateAnnotationState, updateAnnotation] = useAsyncFn(async (event: AnnotationEventUIModel) => {
      const result = await panelContext.updateAnnotation!(event);
      if (onSave) {
        onSave();
      }
      return result;
    });

    const isUpdatingAnnotation = annotation.id !== undefined;
    const stateIndicator = isUpdatingAnnotation ? updateAnnotationState : createAnnotationState;
    const operation = isUpdatingAnnotation ? updateAnnotation : createAnnotation;
    const isRegionAnnotation = annotation.time !== annotation.timeEnd;

    const ts = isRegionAnnotation
      ? `${timeFormatter(annotation.time)} - ${timeFormatter(annotation.timeEnd)}` //range annotation
      : timeFormatter(annotation.time); // single point annotation

    const form = (
      <div // Annotation editor
        ref={ref}
        className={cx(styles.editor, className)}
      >
        <div className={styles.header}>
          <HorizontalGroup justify={'space-between'} align={'center'}>
            <div className={styles.title}>Add annotation</div>
            <div className={styles.ts}>{ts}</div>
          </HorizontalGroup>
        </div>
        <div className={styles.editorForm}>
          <Field label={'Description'}>
            <TextArea
              value={description}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            />
          </Field>
          <Field label={'Tags'}>
            <TagsInput tags={tags} onChange={setTags} />
          </Field>
          <HorizontalGroup justify={'flex-end'}>
            <Button size={'sm'} variant="secondary" onClick={onDismiss} fill="outline">
              Cancel
            </Button>
            <Button
              size={'sm'}
              onClick={() =>
                operation({
                  id: annotation.id,
                  tags,
                  description,
                  from: Math.round(annotation.time!),
                  to: Math.round(annotation.timeEnd!),
                })
              }
              disabled={stateIndicator?.loading}
            >
              {stateIndicator?.loading ? 'Saving' : 'Save'}
            </Button>
          </HorizontalGroup>
        </div>
      </div>
    );

    return <div className={styles.backdrop}>{form}</div>;
  }
);

AnnotationEditorForm.displayName = 'AnnotationEditorForm';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    backdrop: css`
      label: backdrop;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      z-index: ${theme.zIndex.navbarFixed};
    `,
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
      top: 100%;
      left: -4px;
      position: absolute;
    `,
    markerBar: css`
      top: 100%;
      left: 0;
      position: absolute;
    `,
    editorContainer: css`
      position: absolute;
      top: calc(100% + 10px);
      transform: translate3d(-50%, 0, 0);
    `,
    editor: css`
      background: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z3};
      z-index: ${theme.zIndex.dropdown};
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.borderRadius()};
      width: 460px;
    `,
    editorForm: css`
      padding: ${theme.spacing(1)};
    `,
    header: css`
      border-bottom: 1px solid ${theme.colors.border.weak};
      padding: ${theme.spacing(1.5, 1)};
    `,
    title: css`
      font-weight: ${theme.typography.fontWeightMedium};
    `,
    ts: css`
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
    `,
  };
};
