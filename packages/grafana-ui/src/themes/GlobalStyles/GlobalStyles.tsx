import React from 'react';
import { Global } from '@emotion/react';
import { useTheme2 } from '..';
import { getElementStyles } from './elements';

/** @internal */
export function GlobalStyles() {
  const theme = useTheme2();
  const types = getElementStyles(theme);

  return <Global styles={[types]} />;
}
