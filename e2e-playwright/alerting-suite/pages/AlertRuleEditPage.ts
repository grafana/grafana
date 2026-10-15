import { type Locator, type Page, expect } from '@playwright/test';

import { selectors } from '@grafana/e2e-selectors';

export class AlertRuleEditPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/alerting/new');
    await expect(this.nameInput).toBeVisible();
  }

  async gotoEdit(uid: string): Promise<void> {
    await this.page.goto(`/alerting/${encodeURIComponent(uid)}/edit`);
    await expect(this.nameInput).toBeVisible();
  }

  async setName(name: string): Promise<void> {
    await this.nameInput.fill(name);
  }

  async selectFolder(folderName: string): Promise<void> {
    await this.folderPicker.click();
    await this.page.getByRole('treeitem', { name: folderName }).click();
  }

  async useExistingGroup(groupName: string): Promise<void> {
    await this.ensureEvaluationMode('group-based');
    await expect(this.groupSelect).toBeEnabled();
    await this.groupSelect.click();
    await this.page.getByRole('option', { name: groupName }).click();
  }

  async createNewEvaluationGroup(name: string, interval: string): Promise<void> {
    await this.ensureEvaluationMode('group-based');
    await this.page.getByRole('button', { name: /new evaluation group/i }).click();

    const dialog = this.page.getByRole('dialog');
    // Label descriptions leak into the accessible name; testid values carry a literal "data-testid " prefix.
    await dialog.getByTestId('data-testid alert-rule new-evaluation-group-name').fill(name);
    await dialog.getByTestId('data-testid alert-rule new-evaluation-group-interval').fill(interval);
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog).toBeHidden();
  }

  async setEvaluationInterval(interval: string): Promise<void> {
    await this.ensureEvaluationMode('rule-based');
    await this.ungroupedIntervalInput.fill(interval);
  }

  async setEvaluationMode(mode: 'rule-based' | 'group-based'): Promise<void> {
    await this.ensureEvaluationMode(mode);
  }

  async setPendingPeriod(value: string): Promise<void> {
    await this.pendingPeriodInput.fill(value);
  }

  async selectQueryDataSource(dataSourceName: string): Promise<void> {
    // One picker per query row.
    const picker = this.page.getByLabel('Select a data source').first();
    await picker.click();
    // Buttons whose name includes badges: match by prefix.
    await this.page
      .getByRole('option', { name: new RegExp(`^${dataSourceName}\\b`, 'i') })
      .first()
      .click();
  }

  async setManualRouting(contactPointName: string): Promise<void> {
    // Pre-v2 has a routing-mode radio; v2 doesn't.
    const routingRadio = this.page.getByRole('radio', { name: /select contact point/i });
    if (await routingRadio.isVisible()) {
      await routingRadio.check();
    }
    const combobox = this.page.getByRole('combobox', { name: /^(contact point|recipient)$/i });
    await combobox.click();
    // fill skips keystroke events, leaving options unfiltered; click the option.
    await this.page.getByRole('option', { name: new RegExp(`^${contactPointName}\\b`) }).click();
  }

  async addLabel(key: string, value: string): Promise<void> {
    await this.page.getByTestId(selectors.components.AlertRules.addLabelsButton).click();

    const dialog = this.page.getByRole('dialog');
    await dialog.getByRole('button', { name: /add more/i }).click();

    // Enter races async option loading; click the custom-value option.
    await this.fillLabelCombobox(dialog.locator('[data-testid^="labelsInSubform-key-"]').last(), key);
    await this.fillLabelCombobox(dialog.locator('[data-testid^="labelsInSubform-value-"]').last(), value);

    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toBeHidden();
  }

  private async fillLabelCombobox(field: Locator, text: string): Promise<void> {
    await field.getByRole('combobox').click();
    await this.page.keyboard.type(text);
    // Name is the typed text plus "Use custom value".
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await this.page.getByRole('option', { name: new RegExp(`^${escaped}\\b`) }).click();
  }

  async setAnnotations(annotations: { summary?: string; description?: string }): Promise<void> {
    if (annotations.summary !== undefined) {
      await this.page.getByLabel(/summary \(optional\)/i).fill(annotations.summary);
    }
    if (annotations.description !== undefined) {
      await this.page.getByLabel(/description \(optional\)/i).fill(annotations.description);
    }
  }

  async save(): Promise<void> {
    await this.saveButton.click();
  }

  async saveAndWaitForSuccess(outcome: 'created' | 'updated'): Promise<void> {
    await this.save();

    const message = outcome === 'created' ? 'Rule added successfully' : 'Rule updated successfully';
    await expect(this.page.getByRole('status', { name: message })).toBeVisible();
  }

  protected get nameInput(): Locator {
    return this.page.getByRole('textbox', { name: 'name', exact: true });
  }

  protected get folderPicker(): Locator {
    return this.page.getByRole('button', { name: /select folder/i });
  }

  // Via the label: its text varies with folder state.
  get groupSelect(): Locator {
    return this.page.locator('#group');
  }

  get ungroupedIntervalInput(): Locator {
    return this.page.locator('#evaluate-every-no-group');
  }

  get pendingPeriodInput(): Locator {
    return this.page.locator('#eval-for-input');
  }

  // Distinct from the viewer's "Every X".
  groupIntervalHelperText(every: string): Locator {
    return this.page.getByText(new RegExp(`evaluated every ${every}\\.`, 'i'));
  }

  selectedGroupText(name: string): Locator {
    return this.page.getByTestId(selectors.components.AlertRules.groupPicker).getByText(name, { exact: true });
  }

  protected get saveButton(): Locator {
    return this.page.getByTestId(selectors.components.AlertRules.saveRuleButton);
  }

  evaluationModeRadio(mode: 'rule-based' | 'group-based'): Locator {
    const name = mode === 'rule-based' ? /set interval/i : /use groups/i;
    return this.page.getByRole('radio', { name });
  }

  private async ensureEvaluationMode(mode: 'rule-based' | 'group-based'): Promise<void> {
    // Radio renders only with v2 API; 'rule-based' otherwise fails loudly.
    const radio = this.evaluationModeRadio(mode);
    if (await radio.isVisible()) {
      await radio.check();
      return;
    }
    if (mode === 'rule-based') {
      throw new Error(
        'Ungrouped (rule-based) evaluation requires v2 rules API. Enable the relevant feature toggle in test.use().'
      );
    }
  }
}
