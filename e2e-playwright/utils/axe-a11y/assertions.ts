import AxeBuilder from '@axe-core/playwright';
import { Page } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

import { AXE_A11Y_ANNOTATION_TYPE } from './constants';

// TODO: something more sophisticated than threshold count in the future.
export async function runA11yAudit(
  page: Page,
  { disabledRules = [], threshold = 0 }: { disabledRules?: string[]; threshold?: number } = {}
) {
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa' /*'best-practice'*/]) // TODO: enable best-practice in a follow-up commit; https://github.com/grafana/grafana/issues/117836
    .disableRules(disabledRules)
    .analyze();

  test.info().annotations.push({
    type: AXE_A11Y_ANNOTATION_TYPE,
    description: JSON.stringify(accessibilityScanResults, null, 2),
  });

  expect(
    accessibilityScanResults.violations.length,
    `accessibility violations detected${threshold > 0 ? ` (exceeded budget of ${threshold})` : ''}:`
  ).toBeLessThanOrEqual(threshold);
}
