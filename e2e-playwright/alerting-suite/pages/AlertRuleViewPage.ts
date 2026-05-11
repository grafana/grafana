import { type Locator, type Page, expect } from '@playwright/test';

export class AlertRuleViewPage {
  constructor(private readonly page: Page) {}

  async waitForLoad(): Promise<void> {
    await expect(this.nameHeading).toBeVisible();
  }

  async goto(uid: string): Promise<void> {
    await this.page.goto(`/alerting/grafana/${encodeURIComponent(uid)}/view`);
    await this.waitForLoad();
  }

  get nameHeading(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }

  // "Every 1m" in the metadata strip (i18n key alerting.rule-viewer.evaluation-interval)
  get evaluationIntervalText(): Locator {
    return this.page.getByText(/^Every /);
  }

  // Contact-point link in the sidebar "Notification configuration" group.
  // The link also appears in the metadata strip, so scope to avoid strict-mode violations.
  contactPointLink(name: string): Locator {
    return this.page.getByRole('group', { name: 'Notification configuration' }).getByRole('link', { name });
  }

  // Individual label in the metadata strip. aria-label format is "{key}: {value}" (colon).
  label(key: string, value: string): Locator {
    return this.page.getByRole('list', { name: 'Labels' }).getByRole('listitem', { name: `${key}: ${value}` });
  }

  // Annotation value from the sidebar. Uses getByLabel via aria-labelledby association.
  // Requires DetailGroup to expose role="group" aria-label="Annotations" (Details.tsx).
  annotationValue(key: string): Locator {
    return this.page.getByRole('group', { name: 'Annotations' }).getByLabel(key);
  }
}
