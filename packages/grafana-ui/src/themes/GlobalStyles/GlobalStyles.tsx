import React from 'react';
import { Global } from '@emotion/react';
import { useTheme2 } from '..';
import { getElementStyles } from './elements';
import { getCardStyles } from './card';
import { getAgularPanelStyles } from './angularPanelStyles';
import { getPageStyles } from './page';
import { getMarkdownStyles } from './markdownStyles';

/** @internal */
export function GlobalStyles() {
  const theme = useTheme2();

  return (
    <Global
      styles={[
        getElementStyles(theme),
        getPageStyles(theme),
        getCardStyles(theme),
        getAgularPanelStyles(theme),
        getMarkdownStyles(theme),
      ]}
    />
  );
}
