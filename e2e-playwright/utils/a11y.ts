import AxeBuilder from '@axe-core/playwright';
import { Page } from '@playwright/test';

import { expect } from '@grafana/plugin-e2e';

// TODO: something more sophisticated than threshold count in the future.
export async function runA11yAudit(description: string, page: Page, threshold = 0) {
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa' /*'best-practice'*/]) // TODO: enable best-practice in a follow-up commit; https://github.com/grafana/grafana/issues/117836
    .disableRules(['region'])
    .analyze();

  if (accessibilityScanResults.violations.length > 0) {
    console.log(
      `🚨 AXE: ${accessibilityScanResults.violations.length} accessibility violations detected for ${description}`
    );
    console.log('-----------------------------------------------');
    for (const violation of accessibilityScanResults.violations) {
      console.log(`Violation: ${violation.id} - ${violation.description}`);
      console.log(`Impact: ${violation.impact}`);
      if (violation.nodes.length > 0) {
        console.log('Nodes:');
        for (const node of violation.nodes) {
          console.log(`  - ${node.html}`);
        }
      }
      console.log('-----------------------------------------------');
    }
  } else {
    console.log(`✨ AXE: No accessibility violations detected by Axe for ${description}`);
  }

  expect(
    accessibilityScanResults.violations.length,
    `Accessibility violations detected for ${description}${threshold > 0 ? ` (exceeded budget of ${threshold})` : ''}:`
  ).toBeLessThanOrEqual(threshold);
}
