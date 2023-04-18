import { css } from '@emotion/css';
import React, { useCallback } from 'react';
import { useStyles2 } from 'src/themes';

import { GrafanaTheme2 } from '@grafana/data';

interface TextProps {
  children: React.ReactNode;
  color?: keyof GrafanaTheme2['colors']['text'];
}

export const Text = ({ children, color }: TextProps) => {
  const styles = useStyles2(useCallback((theme) => getTextStyles(theme, color), [color]));
  return <span className={styles}>{children}</span>;
};

Text.displayName = 'Text';

const getTextStyles = (theme: GrafanaTheme2, color: TextProps['color'] | undefined) => {
  return css([
    color && {
      color: theme.colors.text[color],
    },
  ]);
};
