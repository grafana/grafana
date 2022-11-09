import { Global } from '@emotion/react';
import React from 'react';

import { useTheme2 } from '..';

import { getAgularPanelStyles } from './angularPanelStyles';
import { getCardStyles } from './card';
import { getElementStyles } from './elements';
import { getFormElementStyles } from './forms';
import { getMarkdownStyles } from './markdownStyles';
import { getPageStyles } from './page';

/** @internal */
export function GlobalStyles() {
  const theme = useTheme2();

  return (
    <Global
      styles={[
        getElementStyles(theme),
        getFormElementStyles(theme),
        getPageStyles(theme),
        getCardStyles(theme),
        getAgularPanelStyles(theme),
        getMarkdownStyles(theme),
      ]}
    />
  );
}
