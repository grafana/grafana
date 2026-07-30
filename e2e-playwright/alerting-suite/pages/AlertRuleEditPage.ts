import { type Locator, type Page, expect } from '@playwright/test';

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
    // The Field labels' description text bleeds into the accessible name, so
    // getByLabel(/evaluation interval/i) double-matches with the name input.
    // Grafana's testid convention prefixes attribute values with the literal
    // "data-testid " — query through the prefix or pick a stable alternative.
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
    // The DataSourcePicker in QueryEditorRowHeader exposes itself by aria-label
    // "Select a data source". Multiple may exist on the page (one per query row),
    // so use the first.
    const picker = this.page.getByLabel('Select a data source').first();
    await picker.click();
    // DataSourcePicker renders each candidate as a `button` (not a `role=option`)
    // whose accessible name combines the DS name with badges/tags
    // (e.g. "gdev-testdata Tags TestData") — match by prefix.
    await this.page
      .getByRole('option', { name: new RegExp(`^${dataSourceName}\\b`, 'i') })
      .first()
      .click();
  }

  async setManualRouting(contactPointName: string): Promise<void> {
    // Pre-v2 the form has a routing-mode radio (`Select contact point` vs.
    // `Use notification policy`); v2 drops it and renders the contact-point
    // combobox directly. Check the radio only if it's actually present.
    const routingRadio = this.page.getByRole('radio', { name: /select contact point/i });
    if (await routingRadio.isVisible()) {
      await routingRadio.check();
    }
    // v2 renames "Contact point" to "Recipient" — match either label.
    const combobox = this.page.getByRole('combobox', { name: /^(contact point|recipient)$/i });
    await combobox.click();
    // Don't type-to-filter: Combobox.fill skips the keystroke events that update
    // its internal search state, so the option list stays unfiltered. Just click
    // the matching option directly from the open dropdown.
    await this.page.getByRole('option', { name: new RegExp(`^${contactPointName}\\b`) }).click();
  }

  async addLabel(key: string, value: string): Promise<void> {
    await this.page.getByTestId('add-labels-button').click();

    const dialog = this.page.getByRole('dialog');
    // The dialog opens with a pre-existing empty row. "Add more" appends a new row at the end;
    // target it via prefix selector + .last() rather than a hardcoded index.
    await dialog.getByRole('button', { name: /add more/i }).click();

    // Each combobox is an `AlertLabelDropdown` (grafana-ui Combobox) with `createCustomValue=true`.
    // Press-and-Enter races with async option loading and silently drops the keystrokes —
    // clicking the explicit custom-value option in the dropdown is the deterministic path.
    await this.fillLabelCombobox(dialog.locator('[data-testid^="labelsInSubform-key-"]').last(), key);
    await this.fillLabelCombobox(dialog.locator('[data-testid^="labelsInSubform-value-"]').last(), value);

    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toBeHidden();
  }

  private async fillLabelCombobox(field: Locator, text: string): Promise<void> {
    await field.getByRole('combobox').click();
    await this.page.keyboard.type(text);
    // The custom-value option's accessible name combines the typed text with the
    // "Use custom value" description (e.g. `"team Use custom value"`), so we anchor
    // a regex to the start of the option name with a word boundary.
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

  // Group `<Select>` rendered as a combobox with inputId="group"; targeted via the
  // form `<label htmlFor="group">` because the Field label text varies with folder state.
  get groupSelect(): Locator {
    return this.page.locator('#group');
  }

  get ungroupedIntervalInput(): Locator {
    return this.page.locator('#evaluate-every-no-group');
  }

  get pendingPeriodInput(): Locator {
    return this.page.locator('#eval-for-input');
  }

  // Form-side helper text "All rules in the selected group are evaluated every X".
  // Distinct from the viewer's metadata-strip "Every X" (AlertRuleViewPage.evaluationIntervalText).
  groupIntervalHelperText(every: string): Locator {
    return this.page.getByText(new RegExp(`evaluated every ${every}\\.`, 'i'));
  }

  selectedGroupText(name: string): Locator {
    return this.page.getByTestId('group-picker').getByText(name, { exact: true });
  }

  protected get saveButton(): Locator {
    return this.page.getByTestId('save-rule');
  }

  evaluationModeRadio(mode: 'rule-based' | 'group-based'): Locator {
    const name = mode === 'rule-based' ? /set interval/i : /use groups/i;
    return this.page.getByRole('radio', { name });
  }

  private async ensureEvaluationMode(mode: 'rule-based' | 'group-based'): Promise<void> {
    // The radio only renders when v2 API is on (shouldUseRulesAPIV2()). When hidden,
    // the form is implicitly group-based; 'rule-based' requires v2 and fails loudly.
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
