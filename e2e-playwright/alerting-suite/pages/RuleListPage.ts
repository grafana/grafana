import { type Locator, type Page, expect } from '@playwright/test';

import { selectors } from '@grafana/e2e-selectors';

import { gotoResilient } from '../waitForAppLoad';

export type RuleListKind = 'alert' | 'recording';

export type SearchLeaf = Record<string, unknown>;

type SearchWhere = SearchLeaf | { and: SearchLeaf[] };

export interface SearchRequestBody {
  where?: SearchWhere;
  fields?: string[];
  sort?: Array<{ field: string; direction: string }>;
  limit?: number;
  continue?: string;
}

function isAnd(where: SearchWhere): where is { and: SearchLeaf[] } {
  return Array.isArray(where.and);
}

export function searchLeaves(body: SearchRequestBody): SearchLeaf[] {
  if (!body.where) {
    return [];
  }
  return isAnd(body.where) ? body.where.and : [body.where];
}

export function filterLeaf(field: string, operator: 'In' | 'NotIn', values: string[]): SearchLeaf {
  return { filter: { field, operator, values } };
}

type LabelOperator = '=' | '!=' | '=~' | '!~' | 'exists' | 'absent';

const LONG_WAIT = 20_000;

/**
 * The Alert and Recording rule pages: search input, filter sidebar and result rows, plus a record
 * of the `/searchRules` bodies the page sent, so a journey can prove a control produced the request
 * it should have and not only that the right rows appear.
 */
export class RuleListPage {
  private readonly searchBodies: SearchRequestBody[] = [];

  constructor(
    private readonly page: Page,
    readonly kind: RuleListKind
  ) {
    const endpoint = `/${kind === 'alert' ? 'alertrules' : 'recordingrules'}/searchRules`;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes(endpoint)) {
        this.searchBodies.push(JSON.parse(request.postData() ?? '{}'));
      }
    });
  }

  get searchInput(): Locator {
    return this.page.getByRole('textbox', { name: /^search/i });
  }

  // Opens the List view with an optional applied search, e.g. a run-scoping label token.
  async goto(search?: string): Promise<void> {
    const params = new URLSearchParams({ view: 'list' });
    if (search) {
      params.set('search', search);
    }
    await gotoResilient(this.page, `/alerting/rules/${this.kind}?${params.toString()}`);
    await expect(this.searchInput).toBeVisible({ timeout: LONG_WAIT });
  }

  async search(text: string): Promise<void> {
    await this.searchInput.fill(text);
    await this.searchInput.press('Enter');
  }

  /** Forget the requests sent so far, so the next assertion can only be satisfied by what the next action sends. */
  forgetRequests(): void {
    this.searchBodies.length = 0;
  }

  async expectRequestLeaf(leaf: SearchLeaf): Promise<void> {
    await expect
      .poll(() => this.searchBodies.flatMap(searchLeaves), {
        message: `a ${this.kind} search request containing ${JSON.stringify(leaf)}`,
        timeout: LONG_WAIT,
      })
      .toContainEqual(leaf);
  }

  async expectRequestFields(fields: string[]): Promise<void> {
    await expect
      .poll(() => this.searchBodies.at(-1)?.fields ?? [], { timeout: LONG_WAIT })
      .toEqual(expect.arrayContaining(fields));
  }

  async expectSearchParam(expected: string | RegExp): Promise<void> {
    await expect
      .poll(() => new URL(this.page.url()).searchParams.get('search') ?? '', { timeout: LONG_WAIT })
      .toEqual(typeof expected === 'string' ? expect.stringContaining(expected) : expect.stringMatching(expected));
  }

  ruleLink(title: string): Locator {
    return this.page.getByRole('link', { name: title, exact: true });
  }

  ruleRow(title: string): Locator {
    return this.page.getByRole('listitem').filter({ has: this.ruleLink(title) });
  }

  // Shown rules are awaited first: the list loads asynchronously, so a rule's absence only means
  // something once the matching ones have rendered.
  async expectRules({ shown, hidden = [] }: { shown: string[]; hidden?: string[] }): Promise<void> {
    for (const title of shown) {
      await expect(this.ruleLink(title)).toBeVisible({ timeout: LONG_WAIT });
    }
    for (const title of hidden) {
      await expect(this.ruleLink(title)).toHaveCount(0);
    }
  }

  get clearFiltersButton(): Locator {
    return this.page.getByRole('button', { name: 'Clear filters' });
  }

  // The sidebar's label is not bound to its control and the fields are not groups, so a field is
  // found as the container (label wrapper -> field stack) of its label text.
  sidebarField(label: string): Locator {
    return this.page
      .locator('label')
      .filter({ hasText: new RegExp(`^${label}$`) })
      .locator('xpath=../..');
  }

  async setRuleName(text: string): Promise<void> {
    const input = this.sidebarField('Rule name').getByRole('textbox');
    await input.fill(text);
    await input.press('Enter');
  }

  async setRecordedMetric(metric: string): Promise<void> {
    await this.sidebarField('Recorded metric').getByRole('textbox').fill(metric);
  }

  // Adds a row and applies it: the row stays a local draft until it has a key, then key and value
  // apply on Enter (the operator applies at once). Requests are recorded from the step after the
  // key, so an assertion is satisfied by the finished matcher and not by the `key=` the key alone applies.
  async addLabelFilter({ key, operator = '=', value }: { key: string; operator?: LabelOperator; value?: string }) {
    const labels = this.sidebarField('Labels');
    const rowCount = await labels.getByRole('textbox', { name: 'Label key' }).count();

    await labels.getByRole('button', { name: 'Add label filter' }).click();
    const keyInput = labels.getByRole('textbox', { name: 'Label key' }).nth(rowCount);
    await keyInput.fill(key);
    await keyInput.press('Enter');

    this.forgetRequests();
    if (operator !== '=') {
      await labels
        .getByRole('radiogroup', { name: 'Label operator' })
        .nth(rowCount)
        .getByRole('radio', { name: operator, exact: true })
        .click();
    }
    if (value !== undefined) {
      const valueInput = labels.getByRole('textbox', { name: 'Label value' }).nth(rowCount);
      await valueInput.fill(value);
      await valueInput.press('Enter');
    }
  }

  async addFolder(title: string): Promise<void> {
    const field = this.sidebarField('Folder');
    await field.getByRole('button', { name: /select folder/i }).click();
    await this.page.getByTestId(selectors.components.FolderPicker.input).fill(title);
    await this.page.getByRole('treeitem', { name: title }).click();
  }

  async addDataSource(name: string, fieldLabel = 'Query data source'): Promise<void> {
    await this.sidebarField(fieldLabel).getByRole('combobox', { name: 'Select a data source' }).click();
    await this.page.getByTestId(selectors.components.DataSourcePicker.dataSourceCard(name)).click();
  }

  async removeSelectedValue(label: string): Promise<void> {
    await this.page.getByRole('button', { name: `Remove ${label}` }).click();
  }

  // The switch's own input is hidden behind its label, so the visible label text is what a user clicks.
  async toggleHidePluginRules(): Promise<void> {
    await this.page.getByText('Hide plugin rules', { exact: true }).click();
  }

  async pickDashboard(title: string): Promise<void> {
    await this.sidebarField('Dashboard').getByRole('combobox').fill(title);
    await this.page.getByRole('option', { name: title }).click();
  }

  async setPanelId(panelId: number): Promise<void> {
    await this.sidebarField('Panel ID').getByRole('spinbutton').fill(String(panelId));
  }

  // Contact point and policy options carry a description, which becomes part of their accessible
  // name, so they are matched by the unique name they start with rather than exactly.
  async pickContactPoint(name: string): Promise<void> {
    await this.pickFromCombobox(this.sidebarField('Contact point').getByRole('combobox'), name);
  }

  async pickPolicy(name: string): Promise<void> {
    await this.pickFromCombobox(this.sidebarField('Notification policy').getByRole('combobox'), name);
  }

  private async pickFromCombobox(combobox: Locator, name: string): Promise<void> {
    await combobox.click();
    await combobox.fill(name);
    await this.page.getByRole('option', { name }).click();
  }

  // The Paused, Alert state and Health selects name themselves with an aria-label equal to their field label.
  async chooseOption(select: 'Paused' | 'Alert state' | 'Health', option: string): Promise<void> {
    await this.page.getByRole('combobox', { name: select, exact: true }).click();
    await this.page.getByRole('option', { name: option, exact: true }).click();
  }

  // The icon's accessible name carries the status the row shows.
  statusIcon(title: string, name: string): Locator {
    return this.ruleRow(title).getByLabel(name, { exact: true });
  }
}
