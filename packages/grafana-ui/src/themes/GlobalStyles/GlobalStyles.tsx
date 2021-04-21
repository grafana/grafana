import React from 'react';
import { Global } from '@emotion/react';
import { useTheme2 } from '..';
import { getElementStyles } from './elements';
import { getCardStyles } from './card';

/** @internal */
export function GlobalStyles() {
  const theme = useTheme2();
  const types = getElementStyles(theme);
  const cards = getCardStyles(theme);

  return <Global styles={[types, cards]} />;
}
