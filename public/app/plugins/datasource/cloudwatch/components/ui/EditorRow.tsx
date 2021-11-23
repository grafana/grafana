import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { stylesFactory, useTheme2 } from '@grafana/ui';
import React from 'react';
import Stack from './Stack';

interface EditorRowProps {}

const EditorRow: React.FC<EditorRowProps> = ({ children }) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <div className={styles.root}>
      <Stack gap={4}>{children}</Stack>
    </div>
  );
};

export default EditorRow;

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    root: css({
      padding: theme.spacing(1),
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.borderRadius(1),
    }),
  };
});
