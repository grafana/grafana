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

  get evaluationIntervalText(): Locator {
    return this.page
      .getByText('Evaluation interval')
      .locator('..')
      .getByText(/^Every /);
  }

  // DetailText renders the value as `<Text aria-labelledby="pending-period">`;
  // getByLabel matches via the aria-labelledby association.
  get pendingPeriodValue(): Locator {
    return this.page.getByLabel('Pending period');
  }

  // Scope to the sidebar group; the contact-point link also appears in the metadata strip.
  contactPointLink(name: string): Locator {
    return this.page.getByRole('group', { name: 'Notification configuration' }).getByRole('link', { name });
  }

  label(key: string, value: string): Locator {
    return this.page.getByRole('list', { name: 'Labels' }).getByRole('listitem', { name: `${key}: ${value}` });
  }

  // Requires DetailGroup to expose role="group" aria-label="Annotations" (Details.tsx).
  annotationValue(key: string): Locator {
    return this.page.getByRole('group', { name: 'Annotations' }).getByLabel(key);
  }

  // exact: false because long names can be visually truncated in the breadcrumb bar.
  breadcrumbLink(name: string): Locator {
    return this.page.getByRole('navigation', { name: 'Breadcrumbs' }).getByRole('link', { name, exact: false });
  }
}
