import { ArrayPageObjectType, ClickablePageObjectType, TestPage } from '@grafana/toolkit/src/e2e';

export interface VariablesPage {
  callToActionButton: ClickablePageObjectType;
  variableTableNameField: ArrayPageObjectType;
  variableTableDefinitionField: ArrayPageObjectType;
  variableTableArrowUpButton: ArrayPageObjectType;
  variableTableArrowDownButton: ArrayPageObjectType;
  variableTableDuplicateButton: ArrayPageObjectType;
  variableTableRemoveButton: ArrayPageObjectType;
  newVariableButton: ClickablePageObjectType;
  goBackButton: ClickablePageObjectType;
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
    newVariableButton: 'Variable editor New variable button',
    goBackButton: 'Dashboard settings Go Back button',
  },
});

export interface AssertVariableTableArguments {
  name: string;
  query: string;
}

export const assertVariableTable = async (page: TestPage<VariablesPage>, args: AssertVariableTableArguments[]) => {
  console.log('Asserting variable table');
  await page.pageObjects.variableTableNameField.waitForSelector();
  await page.pageObjects.variableTableNameField.hasLength(args.length);
  await page.pageObjects.variableTableDefinitionField.hasLength(args.length);
  await page.pageObjects.variableTableArrowUpButton.hasLength(args.length);
  await page.pageObjects.variableTableArrowDownButton.hasLength(args.length);
  await page.pageObjects.variableTableDuplicateButton.hasLength(args.length);
  await page.pageObjects.variableTableRemoveButton.hasLength(args.length);
  for (let index = 0; index < args.length; index++) {
    const { name, query } = args[index];
    await page.pageObjects.variableTableNameField.containsTextAtPos(`$${name}`, index);
    await page.pageObjects.variableTableDefinitionField.containsTextAtPos(query, index);
  }
  console.log('Asserting variable table, Ok');
};
