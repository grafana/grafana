import { Global } from '@emotion/react';

import { useTheme2 } from '../ThemeContext';

import { getAccessibilityStyles } from './accessibility';
import { getAgularPanelStyles } from './angularPanelStyles';
import { getCardStyles } from './card';
import { getCodeStyles } from './code';
import { getElementStyles } from './elements';
import { getExtraStyles } from './extra';
import { getFilterTableStyles } from './filterTable';
import { getFontStyles } from './fonts';
import { getFormElementStyles } from './forms';
import { getJsonFormatterStyles } from './jsonFormatter';
import { getLegacySelectStyles } from './legacySelect';
import { getMarkdownStyles } from './markdownStyles';
import { getPageStyles } from './page';
import { getQueryPartStyles } from './queryPart';
import { getRcTimePickerStyles } from './rcTimePicker';
import { getSkeletonStyles } from './skeletonStyles';
import { getSlateStyles } from './slate';
import { getUplotStyles } from './uPlot';

/** @internal */
export function GlobalStyles() {
  const theme = useTheme2();

  return (
    <Global
      styles={[
        getAccessibilityStyles(theme),
        getAgularPanelStyles(theme),
        getCodeStyles(theme),
        getElementStyles(theme),
        getExtraStyles(theme),
        getFilterTableStyles(theme),
        getFontStyles(theme),
        getFormElementStyles(theme),
        getJsonFormatterStyles(theme),
        getCardStyles(theme),
        getMarkdownStyles(theme),
        getPageStyles(theme),
        getQueryPartStyles(theme),
        getRcTimePickerStyles(theme),
        getSkeletonStyles(theme),
        getSlateStyles(theme),
        getUplotStyles(theme),
        getLegacySelectStyles(theme),
      ]}
    />
  );
}
