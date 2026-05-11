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

  /** Open the edit form for an existing rule by UID. */
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
    await this.page.getByRole('button', { name: folderName, exact: true }).click();
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
    await dialog.getByLabel(/evaluation group name/i).fill(name);
    const intervalField = dialog.getByLabel(/evaluation interval/i);
    await intervalField.fill(interval);
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog).toBeHidden();
  }

  /**
   * Set the evaluation interval directly without an evaluation group (ungrouped flow).
   * Only available when `shouldUseRulesAPIV2()` is enabled — throws if the radio is missing.
   */
  async setEvaluationInterval(interval: string): Promise<void> {
    await this.ensureEvaluationMode('rule-based');
    await this.page.getByLabel(/^evaluation interval$/i).fill(interval);
  }

  /** Submit the form. Caller is responsible for asserting the post-save state. */
  async save(): Promise<void> {
    await this.saveButton.click();
  }

  // ---------- Composite happy-path flows ----------

  async createGrafanaRuleInGroup(opts: { name: string; folder: string; group: string }): Promise<void> {
    await this.setName(opts.name);
    await this.selectFolder(opts.folder);
    await this.useExistingGroup(opts.group);
    await this.save();
  }

  async createUngroupedGrafanaRule(opts: { name: string; folder: string; interval: string }): Promise<void> {
    await this.setName(opts.name);
    await this.selectFolder(opts.folder);
    await this.setEvaluationInterval(opts.interval);
    await this.save();
  }

  // ---------- Locators (protected; expose only if a test needs custom assertions) ----------

  protected get nameInput(): Locator {
    return this.page.getByRole('textbox', { name: 'name' });
  }

  protected get folderPicker(): Locator {
    return this.page.getByRole('button', { name: /select folder/i });
  }

  /**
   * Group `<Select>` rendered as a combobox with `inputId="group"`. We target it via the
   * form `<label htmlFor="group">` because the Field label text varies based on folder state.
   */
  protected get groupSelect(): Locator {
    return this.page.locator('#group');
  }

  protected get saveButton(): Locator {
    return this.page.getByRole('button', { name: 'Save', exact: true });
  }

  protected evaluationModeRadio(mode: 'rule-based' | 'group-based'): Locator {
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
