import { ClickablePageObjectType, PageObjectType, TestPage } from '@grafana/toolkit/src/e2e';

export interface VariablesPage {
  callToActionButton: ClickablePageObjectType;
  variableTableNameField: PageObjectType;
  variableTableDefinitionField: PageObjectType;
  variableTableArrowUpButton: ClickablePageObjectType;
  variableTableArrowDownButton: ClickablePageObjectType;
  variableTableDuplicateButton: ClickablePageObjectType;
  variableTableRemoveButton: ClickablePageObjectType;
}

export const variablesPage = new TestPage<VariablesPage>({
  pageObjects: {
    callToActionButton: 'Call to action button Add variable',
    variableTableNameField: 'Variable editor Table Name field',
    variableTableDefinitionField: 'Variable editor Table Definition field',
    variableTableArrowUpButton: 'Variable editor Table ArrowUp button',
    variableTableArrowDownButton: 'Variable editor Table ArrowDown button',
    variableTableDuplicateButton: 'Variable editor Table Duplicate button',
    variableTableRemoveButton: 'Variable editor Table Remove button',
  },
});
