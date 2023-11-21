import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, ThemeSpacingTokens } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { getResponsiveStyle, ResponsiveProp } from '@grafana/ui/src/components/Layout/utils/responsiveness';

interface IndentProps {
  children?: React.ReactNode;
  level: number;
  spacing: ResponsiveProp<ThemeSpacingTokens>;
}

export function Indent({ children, spacing, level }: IndentProps) {
  const styles = useStyles2(getStyles, spacing, level);

  return <span className={css(styles.indentor)}>{children}</span>;
}

const getStyles = (theme: GrafanaTheme2, spacing: IndentProps['spacing'], level: IndentProps['level']) => ({
  indentor: css(
    getResponsiveStyle(theme, spacing, (val) => ({
      paddingLeft: theme.spacing(val * level),
    }))
  ),
});
