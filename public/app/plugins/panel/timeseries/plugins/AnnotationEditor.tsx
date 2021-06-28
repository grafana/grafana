import React, { useState, useRef, ChangeEvent } from 'react';
import useClickAway from 'react-use/lib/useClickAway';
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
} from '@grafana/ui';
import { colorManipulator, DataFrame, getDisplayProcessor, GrafanaTheme2, TimeZone } from '@grafana/data';

interface AnnotationEditorProps {
  data: DataFrame;
  timeZone: TimeZone;
  selection: PlotSelection;
  onSave: () => void;
  onDismiss: () => void;
}

export const AnnotationEditor: React.FC<AnnotationEditorProps> = ({ onDismiss, onSave, timeZone, data, selection }) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const ref = useRef(null);
  const [description, setDescription] = useState<string>();
  const [tags, setTags] = useState<string[]>([]);
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
  const isRangeAnnotation = selection.min !== selection.max;
  const ts = isRangeAnnotation
    ? `${xFieldFmt(selection.min).text} - ${xFieldFmt(selection.max).text}` //range annotation
    : xFieldFmt(selection.min).text; // single ts annotation

  return (
    <Portal>
      <div // Div overly matching uPlot canvas bbox
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
            isRangeAnnotation ? styles.markerRange : styles.marker
          )}
        >
          <div // Annotation editor
            ref={ref}
            className={cx(
              styles.editorContainer,
              css`
                left: ${selection.bbox.width / 2}px;
              `
            )}
          >
            <div className={styles.header}>
              <HorizontalGroup justify={'space-between'} align={'center'}>
                <div className={styles.title}>Add annotation</div>
                <div className={styles.ts}>{ts}</div>
              </HorizontalGroup>
            </div>
            <div className={styles.editor}>
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
                <Button size={'sm'} onClick={onSave}>
                  Save
                </Button>
              </HorizontalGroup>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    marker: css`
      border-left: 1px dashed ${colorManipulator.alpha(theme.colors.info.shade, 0.7)};
      &:after {
        content: '';
        display: block;
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-bottom: 6px solid ${colorManipulator.alpha(theme.colors.info.shade, 0.5)};
        position: absolute;
        top: 100%;
        left: 0;
        transform: translate3d(-50%, 0, 0);
      }
    `,
    markerRange: css`
      background: ${colorManipulator.alpha(theme.colors.info.shade, 0.1)};
      border-left: 1px dashed ${colorManipulator.alpha(theme.colors.info.shade, 0.7)};
      border-right: 1px dashed ${colorManipulator.alpha(theme.colors.info.shade, 0.7)};

      &:after {
        content: '';
        display: block;
        width: calc(100% + 2px);
        height: 5px;
        position: absolute;
        top: calc(100% + 2px);
        left: -1px;
        background: ${colorManipulator.alpha(theme.colors.info.shade, 0.5)};
      }
    `,

    editorContainer: css`
      background: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z3};
      z-index: ${theme.zIndex.dropdown};
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.borderRadius()};
      position: absolute;
      top: calc(100% + 10px);
      width: 460px;
      transform: translate3d(-50%, 0, 0);
    `,
    editor: css`
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
