import { css } from '@emotion/react';

import { type GrafanaTheme2 } from '@grafana/data';

import { getAccessibilityStyles } from './accessibility';
import { getCodeStyles } from './code';
import { getElementStyles } from './elements';
import { getFormElementStyles } from './forms';
import { getMarkdownStyles } from './markdownStyles';
import { getUtilityClassStyles } from './utilityClasses';

/** Shared content styles for isolated Text documents, in the same order as GlobalStyles. */
export function getTextContentStyles(theme: GrafanaTheme2) {
  return css([
    getAccessibilityStyles(theme),
    getCodeStyles(theme),
    getElementStyles(theme),
    getFormElementStyles(theme),
    getMarkdownStyles(theme),
    getUtilityClassStyles(theme),
  ]);
}
