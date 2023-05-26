import React from 'react';

import { useTheme2 } from '@grafana/ui';

import { INDENT_AMOUNT_CSS_VAR } from '../types';

interface IndentProps {
  children?: React.ReactNode;
  level: number;
}

export function Indent({ children, level }: IndentProps) {
  const theme = useTheme2();

  // DashboardsTree responsively sets the value of INDENT_AMOUNT_CSS_VAR
  // but we also have a fallback just in case it's not set for some reason...
  const space = `var(${INDENT_AMOUNT_CSS_VAR}, ${theme.spacing(2)})`;

  return <span style={{ paddingLeft: `calc(${space} * ${level})` }}>{children}</span>;
}
