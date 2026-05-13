import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Page Object Model for the Grafana-managed alert rule edit form.
 *
 * Locators prefer accessibility queries (`getByRole`, `getByLabel`) over `getByTestId`.
 * Reach for testid only when the underlying component genuinely lacks an accessible name —
 * if you need to add one, prefer fixing the component over papering over with a testid here.
 */
export class AlertRuleEditPage {
  constructor(private readonly page: Page) {}

  // ---------- Navigation ----------

  /** Open the new-rule form. Defaults to a Grafana-managed alert rule. */
  async goto(): Promise<void> {
    await this.page.goto('/alerting/new');
    await expect(this.nameInput).toBeVisible();
  }

  /** Open the edit form for an existing Grafana-managed rule by UID. */
  async gotoEdit(uid: string): Promise<void> {
    await this.page.goto(`/alerting/${encodeURIComponent(uid)}/edit`);
    await expect(this.nameInput).toBeVisible();
  }

  // ---------- High-level actions ----------

  async setName(name: string): Promise<void> {
    await this.nameInput.fill(name);
  }

  /**
   * Pick a folder by visible name. Assumes the folder already exists at the root of the picker;
   * tests should provision required folders out-of-band rather than creating them through the UI.
   */
  async selectFolder(folderName: string): Promise<void> {
    await this.folderPicker.click();
    await this.page.getByRole('treeitem', { name: folderName }).click();
  }

  /**
   * Select an existing evaluation group inside the currently selected folder.
   * Waits for the async ruler-API fetch (`useFetchGroupsForFolder`) to settle before opening the menu.
   */
  async useExistingGroup(groupName: string): Promise<void> {
    await this.ensureEvaluationMode('group-based');
    await expect(this.groupSelect).toBeEnabled();
    await this.groupSelect.click();
    await this.page.getByRole('option', { name: groupName }).click();
  }

  /**
   * Create a new evaluation group via the inline modal.
   * Use when no suitable group exists yet for the selected folder.
   */
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

  /**
   * Set the evaluation interval directly without an evaluation group (ungrouped flow).
   * Only available when `shouldUseRulesAPIV2()` is enabled — throws if the radio is missing.
   */
  async setEvaluationInterval(interval: string): Promise<void> {
    await this.ensureEvaluationMode('rule-based');
    await this.ungroupedIntervalInput.fill(interval);
  }

  /**
   * Public wrapper around `ensureEvaluationMode`. Useful for tests that exercise the
   * `Set interval` ↔ `Use groups` toggle independently of any other helpers.
   */
  async switchEvaluationMode(mode: 'rule-based' | 'group-based'): Promise<void> {
    await this.ensureEvaluationMode(mode);
  }

  /**
   * Fill the pending-period input. The label "Pending period" double-matches via
   * `getByLabel` because of description-bleed in `<Field>`, so we target the input id.
   */
  async setPendingPeriod(value: string): Promise<void> {
    await this.pendingPeriodInput.fill(value);
  }

  /**
   * Switch the data source on the first query row (refId A) to a known one. The form
   * defaults to "first compatible data source", which is non-deterministic across
   * environments — explicit selection keeps tests stable.
   */
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
      .getByRole('button', { name: new RegExp(`^${dataSourceName}\\b`, 'i') })
      .first()
      .click();
  }

  /**
   * Switch the notifications step into "Select contact point" (manual routing) mode
   * and pick the named contact point. The contact point must already exist in the
   * Grafana Alertmanager — `grafana-default-email` ships by default.
   */
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

  /**
   * Add a single label to the rule. Opens the "Edit labels" modal, appends a row,
   * fills key/value via their comboboxes, and saves the modal.
   */
  async addLabel(key: string, value: string): Promise<void> {
    await this.page.getByTestId('add-labels-button').click();

    const dialog = this.page.getByRole('dialog');
    // The dialog opens with a pre-existing empty row (index 0); "Add more" creates a second
    // row at index 1, which is the one we'll fill.
    await dialog.getByRole('button', { name: /add more/i }).click();

    // Each combobox is an `AlertLabelDropdown` (grafana-ui Combobox) with `createCustomValue=true`.
    // Press-and-Enter races with async option loading and silently drops the keystrokes —
    // clicking the explicit custom-value option in the dropdown is the deterministic path.
    await this.fillLabelCombobox(dialog.getByTestId('labelsInSubform-key-1'), key);
    await this.fillLabelCombobox(dialog.getByTestId('labelsInSubform-value-1'), value);

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

  /**
   * Fill the default annotation rows (summary / description). The form pre-renders
   * three annotation slots in a fixed order: summary (0), description (1), runbook URL (2).
   */
  async setAnnotations(annotations: { summary?: string; description?: string }): Promise<void> {
    if (annotations.summary !== undefined) {
      await this.page.getByTestId('annotation-value-0').fill(annotations.summary);
    }
    if (annotations.description !== undefined) {
      await this.page.getByTestId('annotation-value-1').fill(annotations.description);
    }
  }

  /** Submit the form. Caller is responsible for asserting the post-save state. */
  async save(): Promise<void> {
    await this.saveButton.click();
  }

  // ---------- Locators (public when tests assert on them; otherwise protected) ----------

  protected get nameInput(): Locator {
    return this.page.getByRole('textbox', { name: 'name', exact: true });
  }

  protected get folderPicker(): Locator {
    return this.page.getByRole('button', { name: /select folder/i });
  }

  /**
   * Group `<Select>` rendered as a combobox with `inputId="group"`. We target it via the
   * form `<label htmlFor="group">` because the Field label text varies based on folder state.
   */
  get groupSelect(): Locator {
    return this.page.locator('#group');
  }

  /** Ungrouped/rule-based evaluation interval input. Only rendered when v2 + rule-based mode. */
  get ungroupedIntervalInput(): Locator {
    return this.page.locator('#evaluate-every-no-group');
  }

  /** Pending-period input inside the `ForInput` subsection. Alerting rules only. */
  get pendingPeriodInput(): Locator {
    return this.page.locator('#eval-for-input');
  }

  /**
   * Form-side helper text "All rules in the selected group are evaluated every X".
   * Only rendered when a real group is selected. Distinct from the viewer's metadata-strip
   * "Every X" text exposed by `AlertRuleViewPage.evaluationIntervalText`.
   */
  groupIntervalHelperText(every: string): Locator {
    return this.page.getByText(new RegExp(`evaluated every ${every}\\.`, 'i'));
  }

  protected get saveButton(): Locator {
    return this.page.getByTestId('save-rule');
  }

  evaluationModeRadio(mode: 'rule-based' | 'group-based'): Locator {
    const name = mode === 'rule-based' ? /set interval/i : /use groups/i;
    return this.page.getByRole('radio', { name });
  }

  /**
   * The evaluation-mode radio group only renders when v2 API is on (`shouldUseRulesAPIV2()`).
   * When it's hidden, the form is implicitly group-based, so `'group-based'` is a no-op.
   * `'rule-based'` requires the radio — fail loudly if v2 is off.
   */
  private async ensureEvaluationMode(mode: 'rule-based' | 'group-based'): Promise<void> {
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
