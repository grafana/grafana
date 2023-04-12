import React from 'react';

import { INDENT_AMOUNT_CSS_VAR } from '../types';

interface IntendedProps {
  children: React.ReactNode;
  level: number;
}

export function Indented({ children, level }: IntendedProps) {
  return <span style={{ paddingLeft: `calc(var(${INDENT_AMOUNT_CSS_VAR}) * ${level})` }}>{children}</span>;
}
