import { Global } from '@emotion/react';

import { useTheme2 } from '../ThemeContext';

import { getAccessibilityStyles } from './accessibility';
import { getAgularPanelStyles } from './angularPanelStyles';
import { getCardStyles } from './card';
import { getCodeStyles } from './code';
import { getElementStyles } from './elements';
import { getExtraStyles } from './extra';
import { getFontAwesomeStyles } from './fontAwesome';
import { getFontStyles } from './fonts';
import { getFormElementStyles } from './forms';
import { getJsonFormatterStyles } from './jsonFormatter';
import { getLegacySelectStyles } from './legacySelect';
import { getMarkdownStyles } from './markdownStyles';
import { getPageStyles } from './page';
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
        getCodeStyles(theme),
        getElementStyles(theme),
        getExtraStyles(theme),
        getFontAwesomeStyles(theme),
        getFontStyles(theme),
        getFormElementStyles(theme),
        getJsonFormatterStyles(theme),
        getPageStyles(theme),
        getCardStyles(theme),
        getAgularPanelStyles(theme),
        getMarkdownStyles(theme),
        getSkeletonStyles(theme),
        getSlateStyles(theme),
        getRcTimePickerStyles(theme),
        getUplotStyles(theme),
        getLegacySelectStyles(theme),
      ]}
    />
  );
}
