import React, { FC, useMemo } from 'react';
import { css, cx } from 'emotion';
import { CodeEditor, stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme, StandardEditorProps } from '@grafana/data';

import { TextOptions } from './types';

export const TextPanelEditor: FC<StandardEditorProps<string, any, TextOptions>> = ({ value, onChange, context }) => {
  const language = useMemo(() => context.options?.mode ?? 'markdown', [context]);
  const theme = useTheme();
  const styles = getStyles(theme);
  return (
    <div className={cx(styles.editorBox)}>
      <CodeEditor value={value} onChange={onChange} language={language} width="100%" height="150px" />
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  editorBox: css`
    label: editorBox;
    border: ${theme.border.width.sm} solid ${theme.colors.border2};
    border-radius: ${theme.border.radius.sm};
    margin: ${theme.spacing.xs} 0;
  `,
}));
