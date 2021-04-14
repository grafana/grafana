import React from 'react';
import { Global } from '@emotion/react';
import { useTheme } from '..';
import { getElementStyles } from './elements';

export function GlobalStyles() {
  const theme = useTheme();
  const types = getElementStyles(theme.v2);

  return <Global styles={[types]} />;
}
