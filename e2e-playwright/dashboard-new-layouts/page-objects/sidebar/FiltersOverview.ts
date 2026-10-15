import { type Locator, test } from '@playwright/test';

import { PageObject } from '../PageObject';

/** The "Edit filters" pane in the sidebar — label search, filter rows, and group-by selections */
export class FiltersOverview extends PageObject {
  /** Returns the search input that narrows the list of labels */
  getSearchInput(): Locator {
    return this.getByGrafanaSelector(this.selectors.components.Sidebar.container).getByRole('textbox', {
      name: 'Search filters',
      exact: true,
    });
  }

  /** Returns the rows currently rendered by the virtualized list, in display order */
  getRows(): Locator {
    return this.getByGrafanaSelector(this.selectors.components.Sidebar.container).getByTestId(
      this.selectors.components.DashboardFiltersOverview.row
    );
  }

  /**
   * Returns the first rendered row showing the given label
   * @param label the displayed key label, which may differ from the underlying filter key
   */
  getRow(label: string): Locator {
    return this.getRows()
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .first();
  }

  /**
   * Returns the group-by checkbox in the first rendered row showing the given label
   * @param label the displayed key label, which may differ from the underlying filter key
   */
  getGroupByCheckbox(label: string): Locator {
    return this.getRow(label).getByRole('checkbox', { name: 'GroupBy', exact: true });
  }

  /**
   * Selects a filter operator; the option also displays its description
   * @param label the displayed key label, which may differ from the underlying filter key
   */
  async selectOperator(label: string, operator: string) {
    await test.step(`Set operator for "${label}" to "${operator}"`, async () => {
      await this.getRow(label).getByRole('combobox', { name: 'Operator', exact: true }).click();

      await this.getByGrafanaSelector(this.selectors.components.Select.menu)
        .getByRole('option')
        .getByText(operator, { exact: true })
        .click();
    });
  }

  /**
   * Selects an available value for a filter
   * @param label the displayed key label, which may differ from the underlying filter key
   */
  async selectValue(label: string, value: string) {
    await test.step(`Set value for "${label}" to "${value}"`, async () => {
      await this.getRow(label).getByRole('combobox', { name: 'Value', exact: true }).click();

      await this.getByGrafanaSelector(this.selectors.components.Select.menu)
        .getByRole('option', { name: value, exact: true })
        .click();
    });
  }

  /**
   * Toggles grouping through the visible label, which covers the checkbox input
   * @param label the displayed key label, which may differ from the underlying filter key
   */
  async toggleGroupBy(label: string) {
    await test.step(`Toggle group by "${label}"`, async () => {
      await this.getRow(label).getByText('GroupBy', { exact: true }).click();
    });
  }

  /** Applies the pane's pending filter and grouping changes without closing it */
  async applyChanges() {
    await test.step('Apply filter and grouping changes', async () => {
      await this.getByGrafanaSelector(this.selectors.components.Sidebar.container)
        .getByRole('button', { name: 'Apply', exact: true })
        .click();
    });
  }
}
