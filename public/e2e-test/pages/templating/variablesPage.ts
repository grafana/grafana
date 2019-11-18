import { ArrayPageObjectType, ClickablePageObjectType, TestPage } from '@grafana/toolkit/src/e2e';

export interface VariablesPage {
  callToActionButton: ClickablePageObjectType;
  variableTableNameField: ArrayPageObjectType;
  variableTableDefinitionField: ArrayPageObjectType;
  variableTableArrowUpButton: ArrayPageObjectType;
  variableTableArrowDownButton: ArrayPageObjectType;
  variableTableDuplicateButton: ArrayPageObjectType;
  variableTableRemoveButton: ArrayPageObjectType;
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
