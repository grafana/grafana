import { type Locator, type Page, expect } from '@playwright/test';

import { selectors } from '@grafana/e2e-selectors';

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

export function folderScope(...folderUids: string[]): string {
  return folderUids.map((uid) => `namespace:${uid}`).join(' ');
}

/** Path and query without `orgId`, which Grafana adds in multi-org setups. */
export function linkTarget(href: string): { path: string; params: Record<string, string> } {
  const url = new URL(href, 'http://grafana.invalid');
  url.searchParams.delete('orgId');
  return { path: url.pathname, params: Object.fromEntries(url.searchParams) };
}

export async function expectHref(link: Locator, path: string, params: Record<string, string> = {}): Promise<void> {
  await expect
    .poll(async () => {
      const href = await link.getAttribute('href');
      return href === null ? null : linkTarget(href);
    })
    .toEqual({ path, params });
}

type LabelOperator = '=' | '!=' | '=~' | '!~' | 'exists' | 'absent';

/** Records rule search bodies so journeys can prove the request, not only the rows. */
export class RuleListPage {
  private readonly searchBodies: SearchRequestBody[] = [];

  constructor(
    private readonly page: Page,
    readonly kind: RuleListKind
  ) {
    const endpoint = `/${kind === 'alert' ? 'searchAlertRules' : 'searchRecordingRules'}`;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes(endpoint)) {
        this.searchBodies.push(JSON.parse(request.postData() ?? '{}'));
      }
    });
  }

  get searchInput(): Locator {
    return this.page.getByRole('textbox', { name: /^search/i });
  }

  async goto(search?: string): Promise<void> {
    const params = new URLSearchParams({ view: 'list' });
    if (search) {
      params.set('search', search);
    }
    await this.page.goto(`/alerting/rules/${this.kind}?${params.toString()}`);
    await expect(this.searchInput).toBeVisible();
  }

  async search(text: string): Promise<void> {
    await this.searchInput.fill(text);
    await this.searchInput.press('Enter');
  }

  forgetRequests(): void {
    this.searchBodies.length = 0;
  }

  get recordedSearches(): SearchRequestBody[] {
    return this.searchBodies;
  }

  async expectRequestLeaf(leaf: SearchLeaf): Promise<void> {
    await expect
      .poll(() => this.searchBodies.flatMap(searchLeaves), {
        message: `a ${this.kind} search request containing ${JSON.stringify(leaf)}`,
      })
      .toContainEqual(leaf);
  }

  async expectRequestFields(fields: string[]): Promise<void> {
    await expect.poll(() => this.searchBodies.at(-1)?.fields ?? []).toEqual(expect.arrayContaining(fields));
  }

  async expectSearchParam(expected: string | RegExp): Promise<void> {
    await expect
      .poll(() => new URL(this.page.url()).searchParams.get('search') ?? '')
      .toEqual(typeof expected === 'string' ? expect.stringContaining(expected) : expect.stringMatching(expected));
  }

  ruleLink(title: string): Locator {
    return this.page.getByRole('link', { name: title, exact: true });
  }

  // Not the title link: it also matches an expanded folder's own row.
  ruleRow(title: string): Locator {
    return this.page.getByRole('listitem', { name: title, exact: true });
  }

  get newRuleLink(): Locator {
    return this.page.getByRole('link', { name: this.kind === 'alert' ? 'New alert rule' : 'New recording rule' });
  }

  editLink(title: string): Locator {
    return this.ruleRow(title).getByRole('link', { name: 'Edit', exact: true });
  }

  async openRowMenu(title: string): Promise<void> {
    await this.rowMoreButton(title).click();
  }

  async gotoFolders(search?: string): Promise<void> {
    const params = new URLSearchParams();
    if (search) {
      params.set('search', search);
    }
    const query = params.size > 0 ? `?${params.toString()}` : '';
    await this.page.goto(`/alerting/rules/${this.kind}${query}`);
    await expect(this.page.getByRole('radio', { name: 'Folders' })).toBeChecked();
  }

  // Nav sections have expand controls too; stay inside page content.
  get folderRows(): Locator {
    return this.page
      .getByRole('main')
      .getByRole('listitem')
      .filter({ has: this.page.getByRole('button', { name: /^(Expand|Collapse) / }) });
  }

  folderRow(title: string): Locator {
    return this.folderRows.filter({ has: this.page.getByRole('link', { name: title, exact: true }) });
  }

  async toggleFolder(title: string): Promise<void> {
    await this.folderRow(title)
      .getByRole('button', { name: /^(Expand|Collapse) / })
      .click();
  }

  async expectFolders(titles: string[]): Promise<void> {
    await expect(this.folderRows.getByRole('link')).toHaveText(titles);
  }

  get previousButton(): Locator {
    return this.page.getByRole('button', { name: 'Previous', exact: true });
  }

  get nextButton(): Locator {
    return this.page.getByRole('button', { name: 'Next', exact: true });
  }

  // Absence only means something once the list has rendered.
  async expectRules({ shown, hidden = [] }: { shown: string[]; hidden?: string[] }): Promise<void> {
    for (const title of shown) {
      await expect(this.ruleLink(title)).toBeVisible();
    }
    for (const title of hidden) {
      await expect(this.ruleLink(title)).toHaveCount(0);
    }
  }

  get clearFiltersButton(): Locator {
    return this.page.getByRole('button', { name: 'Clear filters' });
  }

  // The page header has a More button too.
  rowMoreButton(title: string): Locator {
    return this.ruleRow(title).getByRole('button', { name: 'More', exact: true });
  }

  sidebarField(label: string): Locator {
    return this.page.getByRole('group', { name: label, exact: true });
  }

  async setRuleName(text: string): Promise<void> {
    const input = this.page.getByRole('textbox', { name: 'Rule name', exact: true });
    await input.fill(text);
    await input.press('Enter');
  }

  async setRecordedMetric(metric: string): Promise<void> {
    await this.page.getByRole('textbox', { name: 'Recorded metric', exact: true }).fill(metric);
  }

  // A row is a draft until it has a key; requests are recorded after the key step so `key=` alone doesn't satisfy assertions.
  async addLabelFilter({ key, operator = '=', value }: { key: string; operator?: LabelOperator; value?: string }) {
    const labels = this.sidebarField('Labels');
    const rowCount = await labels.getByRole('textbox', { name: 'Label key' }).count();

    await labels.getByRole('button', { name: 'Add label filter' }).click();
    const keyInput = labels.getByRole('textbox', { name: 'Label key' }).nth(rowCount);
    await keyInput.fill(key);
    await keyInput.press('Enter');

    this.forgetRequests();
    if (operator !== '=') {
      await labels.getByRole('combobox', { name: 'Label operator' }).nth(rowCount).click();
      await this.page.getByRole('option', { name: operator, exact: true }).click();
    }
    if (value !== undefined) {
      const valueInput = labels.getByRole('textbox', { name: 'Label value' }).nth(rowCount);
      await valueInput.fill(value);
      await valueInput.press('Enter');
    }
  }

  async addFolder(title: string): Promise<void> {
    const field = this.sidebarField('Folder');
    await field.getByRole('button', { name: 'Folder', exact: true }).click();
    // Search box has only a placeholder.
    await field.getByRole('combobox').fill(title);
    await this.page.getByRole('treeitem', { name: title }).click();
  }

  async addDataSource(name: string, fieldLabel = 'Query data source'): Promise<void> {
    const picker = this.sidebarField(fieldLabel).getByRole('combobox', { name: 'Select a data source' });
    await picker.click();
    // Virtualized cards: type the name to bring one into view.
    await picker.fill(name);
    await this.page.getByTestId(selectors.components.DataSourcePicker.dataSourceCard(name)).click();
  }

  async removeSelectedValue(label: string): Promise<void> {
    await this.page.getByRole('button', { name: `Remove ${label}` }).click();
  }

  async toggleHidePluginRules(): Promise<void> {
    await this.page.getByText('Hide plugin rules', { exact: true }).click();
  }

  async pickDashboard(title: string): Promise<void> {
    await this.page.getByRole('combobox', { name: 'Dashboard', exact: true }).fill(title);
    await this.page.getByRole('option', { name: title }).click();
  }

  async setPanelId(panelId: number): Promise<void> {
    await this.page.getByRole('spinbutton', { name: 'Panel ID', exact: true }).fill(String(panelId));
  }

  // Descriptions join the accessible name: match by prefix.
  async pickContactPoint(name: string): Promise<void> {
    await this.pickFromCombobox(this.page.getByRole('combobox', { name: 'Contact point', exact: true }), name);
  }

  async pickPolicy(name: string): Promise<void> {
    await this.pickFromCombobox(this.page.getByRole('combobox', { name: 'Notification policy', exact: true }), name);
  }

  private async pickFromCombobox(combobox: Locator, name: string): Promise<void> {
    await combobox.click();
    await combobox.fill(name);
    await this.page.getByRole('option', { name }).click();
  }

  async chooseOption(select: 'Paused' | 'Alert state' | 'Health', option: string): Promise<void> {
    await this.page.getByRole('combobox', { name: select, exact: true }).click();
    await this.page.getByRole('option', { name: option, exact: true }).click();
  }

  statusIcon(title: string, name: string): Locator {
    return this.ruleRow(title).getByLabel(name, { exact: true });
  }
}
