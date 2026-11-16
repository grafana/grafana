import { type Locator, test } from '@playwright/test';

import { PageObject, type PageObjectArgs } from '../PageObject';

import { GridLayoutOptions } from './shared/GridLayoutOptions';

type VariableListName = 'Above dashboard' | 'Controls menu' | 'Hidden';

// the options group id of each placement list, see DashboardVariablesList.tsx
const variableListIds: Record<VariableListName, string> = {
  'Above dashboard': 'variables-list-visible',
  'Controls menu': 'variables-list-controls-menu',
  Hidden: 'variables-list-hidden',
};

/**
 * The "Dashboard options" pane in the sidebar — title/description inputs, the variables list,
 * plus the shared layout switcher (auto/custom grid, rows, tabs)
 */
export class DashboardOptions extends PageObject {
  readonly gridLayoutOptions: GridLayoutOptions;

  constructor(args: PageObjectArgs) {
    super(args);
    this.gridLayoutOptions = new GridLayoutOptions(args);
  }

  /** Returns the dashboard title input */
  getTitleInput(): Locator {
    return this.getByGrafanaSelector(
      this.selectors.components.PanelEditor.OptionsPane.fieldLabel('dashboard-options Title')
    ).locator('input');
  }

  /** Returns the dashboard description textarea */
  getDescriptionTextarea(): Locator {
    return this.getByGrafanaSelector(
      this.selectors.components.PanelEditor.OptionsPane.fieldLabel('dashboard-options Description')
    ).locator('textarea');
  }

  /** The "Variables" category, which lists the dashboard variables by placement */
  readonly variableList = {
    /** Returns the placement list (header included), which is also the drop target when dragging a variable into it */
    getList: (listName: VariableListName): Locator =>
      this.getByGrafanaSelector(this.selectors.components.Sidebar.container).getByTestId(
        this.selectors.components.OptionsGroup.group(variableListIds[listName])
      ),
    /** Expands the placement list when it is collapsed, which is the initial state of an empty list */
    expand: async (listName: VariableListName) => {
      const toggle = this.variableList
        .getList(listName)
        .getByTestId(this.selectors.components.OptionsGroup.toggle(variableListIds[listName]));

      // the toggle collapses an already-open list, so only click when collapsed
      if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
        await test.step(`Expand the "${listName}" variables list`, async () => {
          await toggle.click();
        });
      }
    },
    /** Returns every variable of the placement list, in display order; each item's text is the variable name */
    getItems: (listName: VariableListName): Locator => this.variableList.getList(listName).getByRole('listitem'),
    /** Returns the variable's item, whatever its placement list */
    getItem: (variableName: string): Locator =>
      this.getByGrafanaSelector(this.selectors.components.Sidebar.container)
        .getByTestId(this.selectors.components.OptionsGroup.group('dashboard-variables'))
        .getByRole('listitem')
        .filter({ has: this.page.getByText(variableName, { exact: true }) }),
    /** Duplicates the variable with its item's "Duplicate" button */
    duplicate: async (variableName: string) => {
      await test.step(`Duplicate variable "${variableName}" from the variables list`, async () => {
        const item = this.variableList.getItem(variableName);
        // the item's buttons are only visible while it is hovered
        await item.hover();
        await item.getByRole('button', { name: 'Duplicate', exact: true }).click();
      });
    },
    /** Deletes the variable with its item's "Delete" button, then confirms in the confirmation modal */
    delete: async (variableName: string) => {
      await test.step(`Delete variable "${variableName}" from the variables list`, async () => {
        const item = this.variableList.getItem(variableName);
        // the item's buttons are only visible while it is hovered
        await item.hover();
        await item.getByRole('button', { name: 'Delete', exact: true }).click();
        // despite its name, ConfirmModal.delete is the testid of every ConfirmModal confirm button (see ConfirmContent.tsx)
        await this.getByGrafanaSelector(this.selectors.pages.ConfirmModal.delete).click();
      });
    },
  };
}
