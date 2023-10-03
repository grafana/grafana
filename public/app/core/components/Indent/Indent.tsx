import { css } from '@emotion/css';
import React from 'react';

import { ThemeSpacingTokens } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import { getResponsiveStyle, ResponsiveProp } from '@grafana/ui/src/components/Layout/utils/responsiveness';

interface IndentProps {
  children?: React.ReactNode;
  level: number;
  spacing: ResponsiveProp<ThemeSpacingTokens>;
}

export function Indent({ children, spacing, level }: IndentProps) {
  const theme = useTheme2();

  const padding = getResponsiveStyle(theme, spacing, (val) => ({
    paddingLeft: theme.spacing(val * level),
  }));

  return <span className={css(padding)}>{children}</span>;
}
