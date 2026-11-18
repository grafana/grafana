import { css } from '@emotion/react';

import { type GrafanaTheme2 } from '@grafana/data';

import { getAccessibilityStyles } from './accessibility';
import { getCardStyles } from './card';
import { getCodeStyles } from './code';
import { getElementStyles } from './elements';
import { getFilterTableStyles } from './filterTable';
import { getFormElementStyles } from './forms';
import { getMarkdownStyles } from './markdownStyles';
import { getUtilityClassStyles } from './utilityClasses';

/**
 * Shared content styles for isolated Text documents, in the same order as GlobalStyles.
 * Card and filter-table classes are included because saved v1 Text panel HTML relies on them.
 */
export function getTextContentStyles(theme: GrafanaTheme2) {
  return css([
    getAccessibilityStyles(theme),
    getCodeStyles(theme),
    getElementStyles(theme),
    getFilterTableStyles(theme),
    getFormElementStyles(theme),
    getCardStyles(theme),
    getMarkdownStyles(theme),
    getUtilityClassStyles(theme),
  ]);
}
