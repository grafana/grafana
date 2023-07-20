import { css } from '@emotion/css';
import React, { HTMLAttributes } from 'react';

import { DataFrame, getDisplayProcessor, GrafanaTheme2, TimeZone } from '@grafana/data';
import { PlotSelection, useStyles2, useTheme2 } from '@grafana/ui';

import { AnnotationsDataFrameViewDTO } from '../types';

import { AnnotationEditorForm } from './AnnotationEditorForm';

interface AnnotationEditor2Props extends HTMLAttributes<HTMLDivElement> {
  data: DataFrame;
  timeZone: TimeZone;
  selection: PlotSelection;
  onSave: () => void;
  onDismiss: () => void;
  annotation?: AnnotationsDataFrameViewDTO;
}
export const AnnotationEditor2 = ({
  timeZone,
  data,
  selection,
  annotation,
  onDismiss,
  onSave,
}: AnnotationEditor2Props) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  let xField = data.fields[0];
  if (!xField) {
    return null;
  }
  const xFieldFmt = xField.display || getDisplayProcessor({ field: xField, timeZone, theme });

  annotation = annotation || ({ time: selection.min, timeEnd: selection.max } as AnnotationsDataFrameViewDTO);
  console.log('annotation', annotation);

  return (
    <div className={styles.wrapper}>
      <AnnotationEditorForm
        annotation={annotation}
        timeFormatter={(v) => xFieldFmt(v).text}
        onSave={onSave}
        onDismiss={onDismiss}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css``,
  };
};
