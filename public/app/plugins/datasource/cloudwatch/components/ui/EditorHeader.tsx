import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { stylesFactory, useTheme2 } from '@grafana/ui';
import React from 'react';
import Stack from './Stack';

interface EditorHeaderProps {}

const EditorHeader: React.FC<EditorHeaderProps> = ({ children }) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <div className={styles.root}>
      <Stack gap={3} alignItems="center">
        {children}
      </Stack>
    </div>
  );
};

export default EditorHeader;

const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  root: css({
    padding: theme.spacing(0, 1),
  }),
}));
