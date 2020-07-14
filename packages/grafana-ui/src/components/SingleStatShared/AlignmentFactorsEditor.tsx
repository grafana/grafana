import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { stylesFactory, useTheme } from '../../themes';
import { GrafanaTheme, StandardEditorProps, DisplayValueAlignmentFactors, FieldDisplay } from '@grafana/data';

export interface AlignmentFactorsEditorOptions {
  getValues: () => FieldDisplay[];
}

export const AlignmentFactorsEditor: FC<StandardEditorProps<
  DisplayValueAlignmentFactors,
  any,
  AlignmentFactorsEditorOptions
>> = ({ value, onChange, context }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div>
      DisplayValueAlignmentFactors!!!
      <br />
      <div className={cx(styles.editorBox)}>HELLO</div>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  editorBox: css`
    label: editorBox;
    border: ${theme.border.width.sm} solid ${theme.colors.border2};
    border-radius: ${theme.border.radius.sm};
    margin: ${theme.spacing.xs} 0;
    width: 100%;
  `,
}));
