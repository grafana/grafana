import React, { FC, useCallback } from 'react';
import { css, cx } from 'emotion';
import { stylesFactory, useTheme } from '../../themes';
import { GrafanaTheme, StandardEditorProps, DisplayValueAlignmentFactors, FieldDisplay } from '@grafana/data';
import { Button } from '../Button';

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

  const onStartEditing = useCallback(() => {
    console.log('START');
  }, []);

  if (!value) {
    return (
      <div>
        Using default values!!!
        <Button onClick={onStartEditing}>Clear</Button>
      </div>
    );
  }

  return (
    <div>
      DisplayValueAlignmentFactors!!!
      <br />
      <div>Title</div>
      <div className={cx(styles.editorBox)}>HELLO</div>
      <div>Text</div>
      <div className={cx(styles.editorBox)}>HELLO</div>
      <div>Prefix</div>
      <div className={cx(styles.editorBox)}>HELLO</div>
      <div>Suffix</div>
      <div className={cx(styles.editorBox)}>HELLO</div>
      <Button onClick={onStartEditing}>Clear</Button>
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
    padding: 4px;
  `,
}));
