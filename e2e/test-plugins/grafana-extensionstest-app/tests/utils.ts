import { Page } from '@playwright/test';

import { selectors } from '@grafana/e2e-selectors';

export async function ensureExtensionRegistryIsPopulated(page: Page) {
  // Due to these plugins using the old getter extensions api we need to force a refresh by navigating home then back
  // to guarantee the extensions are available to the plugin before we interact with the page.
  await page.getByTestId(selectors.components.Breadcrumbs.breadcrumb('Home')).click();
  await page.goBack();
}
