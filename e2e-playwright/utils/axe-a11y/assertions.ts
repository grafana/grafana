import AxeBuilder from '@axe-core/playwright';
import { Page } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

import { AXE_A11Y_ANNOTATION_TYPE } from './constants';
import { AxeA11yReportAnnotation, AxeA11yReportOptions } from './types';

export const runA11yAudit = async (page: Page, options?: AxeA11yReportOptions) => {
  const { disabledRules = [], threshold = 0 } = options ?? {};
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa' /*'best-practice'*/]) // TODO: enable best-practice in a follow-up commit; https://github.com/grafana/grafana/issues/117836
    .disableRules(disabledRules)
    .analyze();

  const anno: AxeA11yReportAnnotation = {
    result: accessibilityScanResults,
    options,
  };

  test.info().annotations.push({
    type: AXE_A11Y_ANNOTATION_TYPE,
    description: JSON.stringify(anno, null, 2),
  });

  expect(
    accessibilityScanResults.violations.length,
    `accessibility violations detected${threshold > 0 ? ` (exceeded budget of ${threshold})` : ''}:`
  ).toBeLessThanOrEqual(threshold);
};
