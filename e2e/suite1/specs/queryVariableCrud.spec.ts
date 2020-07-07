import { e2e } from '@grafana/e2e';

// skipped scenario helper because of some perf issue upgrading cypress to 4.5.0 and splitted the whole test into smaller
// several it functions. Very important to keep the order of these it functions because they have dependency in the order
// https://github.com/cypress-io/cypress/issues/5987
// https://github.com/cypress-io/cypress/issues/6023#issuecomment-574031655
describe.skip('Variables', () => {
  let lastUid = '';
  let lastData = '';
  let variables: VariablesData[] = [
    { name: 'query1', query: '*', label: 'query1-label', options: ['All', 'A', 'B', 'C'], selectedOption: 'A' },
    {
      name: 'query2',
      query: '$query1.*',
      label: 'query2-label',
      options: ['All', 'AA', 'AB', 'AC'],
      selectedOption: 'AA',
    },
    {
      name: 'query3',
      query: '$query1.$query2.*',
      label: 'query3-label',
      options: ['All', 'AAA', 'AAB', 'AAC'],
      selectedOption: 'AAA',
    },
  ];

  beforeEach(() => {
    e2e.flows.login('admin', 'admin');
    if (!lastUid || !lastData) {
      e2e.flows.addDataSource();
      e2e.flows.addDashboard();
    } else {
      e2e.setScenarioContext({ lastAddedDataSource: lastData, lastAddedDashboardUid: lastUid });
    }

    e2e.getScenarioContext().then(({ lastAddedDashboardUid, lastAddedDataSource }: any) => {
      e2e.flows.openDashboard({ uid: lastAddedDashboardUid });
      lastUid = lastAddedDashboardUid;
      lastData = lastAddedDataSource;
    });
  });

  it(`asserts defaults`, () => {
    e2e.pages.Dashboard.Toolbar.toolbarItems('Dashboard settings').click();
    e2e.pages.Dashboard.Settings.General.sectionItems('Variables').click();
    e2e.pages.Dashboard.Settings.Variables.List.addVariableCTA().click();

    assertDefaultsForNewVariable();
  });

  variables.forEach((variable, index) => {
    it(`creates variable ${variable.name}`, () => {
      e2e.pages.Dashboard.Toolbar.toolbarItems('Dashboard settings').click();
      e2e.pages.Dashboard.Settings.General.sectionItems('Variables').click();

      if (index === 0) {
        e2e.pages.Dashboard.Settings.Variables.List.addVariableCTA().click();
      } else {
        e2e.pages.Dashboard.Settings.Variables.List.newButton().click();
      }

      const { name, label, query, options, selectedOption } = variable;
      e2e.getScenarioContext().then(({ lastAddedDataSource }: any) => {
        createQueryVariable({
          dataSourceName: lastAddedDataSource,
          name,
          label,
          query,
          options,
          selectedOption,
        });
      });

      e2e.pages.Dashboard.Settings.General.saveDashBoard()
        .should('be.visible')
        .click();
      e2e.pages.SaveDashboardModal.save()
        .should('be.visible')
        .click();
      e2e.flows.assertSuccessNotification();

      e2e.components.BackButton.backArrow()
        .should('be.visible')
        .click();
    });
  });

  it(`asserts submenus`, () => {
    assertVariableLabelsAndComponents(variables);
  });

  it(`asserts variable table`, () => {
    e2e.pages.Dashboard.Toolbar.toolbarItems('Dashboard settings')
      .should('be.visible')
      .click();
    e2e.pages.Dashboard.Settings.General.sectionItems('Variables')
      .should('be.visible')
      .click();

    assertVariableTable(variables);
  });

  it(`asserts variable selects`, () => {
    assertSelects(variables);
  });

  it(`asserts duplicate variable`, () => {
    // mutates variables
    variables = assertDuplicateItem(variables);
    e2e.flows.saveDashboard();
  });

  it(`asserts delete variable`, () => {
    // mutates variables
    variables = assertDeleteItem(variables);
    e2e.flows.saveDashboard();
  });

  it(`asserts update variable`, () => {
    // mutates variables
    variables = assertUpdateItem(variables);
    e2e.components.BackButton.backArrow()
      .should('be.visible')
      .should('be.visible')
      .click();
    e2e.flows.saveDashboard();
  });

  it(`asserts move variable down`, () => {
    e2e.pages.Dashboard.Toolbar.toolbarItems('Dashboard settings')
      .should('be.visible')
      .click();
    e2e.pages.Dashboard.Settings.General.sectionItems('Variables')
      .should('be.visible')
      .click();

    // mutates variables
    variables = assertMoveDownItem(variables);
    e2e.flows.saveDashboard();
  });

  it(`asserts move variable up`, () => {
    e2e.pages.Dashboard.Toolbar.toolbarItems('Dashboard settings')
      .should('be.visible')
      .click();
    e2e.pages.Dashboard.Settings.General.sectionItems('Variables')
      .should('be.visible')
      .click();

    // mutates variables
    assertMoveUpItem(variables);
  });
});

interface VariablesData {
  name: string;
  query: string;
  label: string;
  options: string[];
  selectedOption: string;
}

interface CreateQueryVariableArguments extends VariablesData {
  dataSourceName: string;
}

const assertDefaultsForNewVariable = () => {
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalNameInput().within(input => {
    expect(input.attr('placeholder')).equals('name');
    expect(input.val()).equals('');
  });
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelect().within(select => {
    e2e()
      .get('option:selected')
      .should('have.text', 'Query');
  });
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInput().within(input => {
    expect(input.attr('placeholder')).equals('optional display name');
    expect(input.val()).equals('');
  });
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalHideSelect().within(select => {
    e2e()
      .get('option:selected')
      .should('have.text', '');
  });

  e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsDataSourceSelect().within(select => {
    e2e()
      .get('option:selected')
      .should('have.text', '');
  });

  e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput().should('not.exist');
  e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRefreshSelect().within(select => {
    e2e()
      .get('option:selected')
      .should('have.text', 'Never');
  });
  e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInput().within(input => {
    expect(input.attr('placeholder')).equals('/.*-(.*)-.*/');
    expect(input.val()).equals('');
  });
  e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsSortSelect().within(select => {
    e2e()
      .get('option:selected')
      .should('have.text', 'Disabled');
  });
  e2e.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch().within(select => {
    e2e()
      .get('input')
      .should('not.be.checked');
  });
  e2e.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch().within(select => {
    e2e()
      .get('input')
      .should('not.be.checked');
  });
  e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.valueGroupsTagsEnabledSwitch().within(select => {
    e2e()
      .get('input')
      .should('not.be.checked');
  });
  e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption().should('not.exist');
  e2e.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput().should('not.exist');
};

const createQueryVariable = ({ name, label, dataSourceName, query }: CreateQueryVariableArguments) => {
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalNameInput().should('be.visible');
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalNameInput().type(name);
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInput().type(label);
  e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsDataSourceSelect()
    .select(`${dataSourceName}`)
    .blur();
  e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput()
    .type(query)
    .blur();
  e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption().should('exist');
  e2e.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch()
    .click()
    .within(() => {
      e2e()
        .get('input')
        .should('be.checked');
    });
  e2e.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch()
    .click()
    .within(() => {
      e2e()
        .get('input')
        .should('be.checked');
    });
  e2e.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput().within(input => {
    expect(input.attr('placeholder')).equals('blank = auto');
    expect(input.val()).equals('');
  });
  e2e.pages.Dashboard.Settings.Variables.Edit.General.addButton().click();
};

const assertVariableLabelAndComponent = ({ label, options, selectedOption }: VariablesData) => {
  e2e.pages.Dashboard.SubMenu.submenuItemLabels(label).should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(selectedOption)
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown().should('be.visible');
  for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts(options[optionIndex]).should('be.visible');
  }
};

const assertVariableLabelsAndComponents = (args: VariablesData[]) => {
  e2e.pages.Dashboard.SubMenu.submenuItem().should('have.length', args.length);
  for (let index = 0; index < args.length; index++) {
    e2e.pages.Dashboard.SubMenu.submenuItem()
      .eq(index)
      .within(() => {
        e2e()
          .get('label')
          .contains(args[index].name);
      });
    assertVariableLabelAndComponent(args[index]);
  }
};

const assertVariableTableRow = ({ name, query }: VariablesData, index: number, length: number) => {
  e2e.pages.Dashboard.Settings.Variables.List.tableRowNameFields(name)
    .should('exist')
    .contains(name);
  e2e.pages.Dashboard.Settings.Variables.List.tableRowDefinitionFields(name)
    .should('exist')
    .contains(query);
  if (index !== length - 1) {
    e2e.pages.Dashboard.Settings.Variables.List.tableRowArrowDownButtons(name).should('exist');
  }
  if (index !== 0) {
    e2e.pages.Dashboard.Settings.Variables.List.tableRowArrowUpButtons(name).should('exist');
  }
  e2e.pages.Dashboard.Settings.Variables.List.tableRowDuplicateButtons(name).should('exist');
  e2e.pages.Dashboard.Settings.Variables.List.tableRowRemoveButtons(name).should('exist');
};

const assertVariableTable = (args: VariablesData[]) => {
  e2e.pages.Dashboard.Settings.Variables.List.table()
    .should('be.visible')
    .within(() => {
      e2e()
        .get('tbody > tr')
        .should('have.length', args.length);
    });

  for (let index = 0; index < args.length; index++) {
    assertVariableTableRow(args[index], index, args.length);
  }
};

const assertSelects = (variables: VariablesData[]) => {
  // Values in submenus should be
  // query1: [A] query2: [AA] query3: [AAA]
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A')
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A')
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('B')
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.Toolbar.navBar().click();
  // Values in submenus should be
  // query1: [B] query2: [All] query3: [All]
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All')
    .should('be.visible')
    .should('have.length', 2);
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All')
    .eq(0)
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BA').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BB').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BC').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BB')
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.Toolbar.navBar()
    .should('be.visible')
    .click();
  // Values in submenus should be
  // query1: [B] query2: [BB] query3: [All]
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All')
    .should('be.visible')
    .should('have.length', 1);
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All')
    .eq(0)
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBA').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBB').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBC').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBB')
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.Toolbar.navBar()
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All').should('have.length', 0);
  // Values in submenus should be
  // query1: [B] query2: [BB] query3: [BBB]
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BB')
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BA').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BB').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BC').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BC')
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.Toolbar.navBar()
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BB + BC')
    .should('be.visible')
    .should('have.length', 1);
  // Values in submenus should be
  // query1: [B] query2: [BB + BC] query3: [BBB]
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BBB')
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBA').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBB').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBC').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BCA').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BCB').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BCC').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BCC')
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.Toolbar.navBar()
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BBB + BCC')
    .should('be.visible')
    .should('have.length', 1);
  // Values in submenus should be
  // query1: [B] query2: [BB + BC] query3: [BBB + BCC]
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BB + BC')
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BA').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BB').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BC').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BA')
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BB')
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BC')
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.Toolbar.navBar()
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BA')
    .should('be.visible')
    .should('have.length', 1);
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All')
    .should('be.visible')
    .should('have.length', 1);
  // Values in submenus should be
  // query1: [B] query2: [BA] query3: [All]
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('B')
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A')
    .should('be.visible')
    .should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('B')
    .should('be.visible')
    .should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('C')
    .should('be.visible')
    .should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A')
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('B')
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.Toolbar.navBar()
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A')
    .should('be.visible')
    .should('have.length', 1);
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All')
    .should('be.visible')
    .should('have.length', 2);
  // Values in submenus should be
  // query1: [A] query2: [All] query3: [All]
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All')
    .eq(0)
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AA')
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.Toolbar.navBar()
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A')
    .should('be.visible')
    .should('have.length', 1);
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('AA')
    .should('be.visible')
    .should('have.length', 1);
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All')
    .should('be.visible')
    .should('have.length', 1);
  // Values in submenus should be
  // query1: [A] query2: [AA] query3: [All]
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All')
    .eq(0)
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AAA')
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.Toolbar.navBar()
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A')
    .should('be.visible')
    .should('have.length', 1);
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('AA')
    .should('be.visible')
    .should('have.length', 1);
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('AAA')
    .should('be.visible')
    .should('have.length', 1);
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All').should('have.length', 0);
};

const assertDuplicateItem = (variables: VariablesData[]) => {
  const itemToDuplicate = variables[1];
  e2e.pages.Dashboard.Toolbar.toolbarItems('Dashboard settings').click();
  e2e.pages.Dashboard.Settings.General.sectionItems('Variables').click();
  e2e.pages.Dashboard.Settings.Variables.List.tableRowDuplicateButtons(itemToDuplicate.name)
    .should('exist')
    .click();
  e2e.pages.Dashboard.Settings.Variables.List.table()
    .should('be.visible')
    .within(() => {
      e2e()
        .get('tbody > tr')
        .should('have.length', variables.length + 1);
    });
  const newItem = { ...itemToDuplicate, name: `copy_of_${itemToDuplicate.name}` };
  assertVariableTableRow(newItem, variables.length - 1, variables.length);
  e2e.pages.Dashboard.Settings.Variables.List.tableRowNameFields(newItem.name).click();

  newItem.label = `copy_of_${itemToDuplicate.label}`;
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInput()
    .clear()
    .type(newItem.label);

  e2e.pages.Dashboard.Settings.General.saveDashBoard().click();
  e2e.pages.SaveDashboardModal.save().click();
  e2e.flows.assertSuccessNotification();

  e2e.components.BackButton.backArrow()
    .should('be.visible')
    .click();

  e2e.pages.Dashboard.SubMenu.submenuItemLabels(newItem.label).should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(newItem.selectedOption)
    .should('be.visible')
    .eq(1)
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown().should('be.visible');
  for (let optionIndex = 0; optionIndex < newItem.options.length; optionIndex++) {
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts(newItem.options[optionIndex]).should('be.visible');
  }

  return [...variables, newItem];
};

const assertDeleteItem = (variables: VariablesData[]) => {
  const itemToDelete = variables[1];
  e2e.pages.Dashboard.Toolbar.toolbarItems('Dashboard settings').click();
  e2e.pages.Dashboard.Settings.General.sectionItems('Variables').click();

  e2e.pages.Dashboard.Settings.Variables.List.tableRowRemoveButtons(itemToDelete.name).click();
  e2e.pages.Dashboard.Settings.Variables.List.table()
    .should('be.visible')
    .within(() => {
      e2e()
        .get('tbody > tr')
        .should('have.length', variables.length - 1);
    });

  e2e.pages.Dashboard.Settings.General.saveDashBoard().click();
  e2e.pages.SaveDashboardModal.save().click();
  e2e.flows.assertSuccessNotification();

  e2e.components.BackButton.backArrow()
    .should('be.visible')
    .click();

  e2e.pages.Dashboard.SubMenu.submenuItemLabels(itemToDelete.label).should('not.exist');

  return variables.filter(item => item.name !== itemToDelete.name);
};

const assertUpdateItem = (data: VariablesData[]) => {
  const variables = [...data];
  // updates an item to a constant variable instead
  const itemToUpdate = variables[1];
  let updatedItem = {
    ...itemToUpdate,
    name: `update_of_${itemToUpdate.name}`,
    label: `update_of_${itemToUpdate.label}`,
    query: 'A constant',
    options: ['A constant'],
    selectedOption: 'undefined',
  };

  variables[1] = updatedItem;

  e2e.pages.Dashboard.Toolbar.toolbarItems('Dashboard settings').click();
  e2e.pages.Dashboard.Settings.General.sectionItems('Variables').click();
  e2e.pages.Dashboard.Settings.Variables.List.tableRowNameFields(itemToUpdate.name).click();

  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalNameInput().should('be.visible');
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalNameInput()
    .should('have.value', itemToUpdate.name)
    .clear()
    .type(updatedItem.name);
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInput()
    .should('have.value', itemToUpdate.label)
    .clear()
    .type(updatedItem.label);
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelect().select('Constant');
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalHideSelect().within(select => {
    e2e()
      .get('option:selected')
      .should('have.text', 'Variable');
  });
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalHideSelect().select('');
  e2e.pages.Dashboard.Settings.Variables.Edit.ConstantVariable.constantOptionsQueryInput().type(updatedItem.query);

  e2e.components.BackButton.backArrow()
    .should('be.visible')
    .click();

  variables[1].selectedOption = 'A constant';
  assertVariableLabelAndComponent(variables[1]);

  e2e.pages.Dashboard.Toolbar.toolbarItems('Dashboard settings').click();
  e2e.pages.Dashboard.Settings.General.sectionItems('Variables').click();

  assertVariableTableRow(variables[1], 1, variables.length);

  variables[1].selectedOption = 'A constant';

  return variables;
};

const assertMoveDownItem = (data: VariablesData[]) => {
  const variables = [...data];
  e2e.pages.Dashboard.Settings.Variables.List.tableRowArrowDownButtons(variables[0].name).click();
  const temp = { ...variables[0] };
  variables[0] = { ...variables[1] };
  variables[1] = temp;
  e2e.pages.Dashboard.Settings.Variables.List.table().within(() => {
    e2e()
      .get('tbody > tr')
      .eq(0)
      .within(() => {
        e2e()
          .get('td')
          .eq(0)
          .contains(variables[0].name);
        e2e()
          .get('td')
          .eq(1)
          .contains(variables[0].query);
      });
    e2e()
      .get('tbody > tr')
      .eq(1)
      .within(() => {
        e2e()
          .get('td')
          .eq(0)
          .contains(variables[1].name);
        e2e()
          .get('td')
          .eq(1)
          .contains(variables[1].query);
      });
  });

  e2e.components.BackButton.backArrow()
    .should('be.visible')
    .click();

  assertVariableLabelsAndComponents(variables);

  return variables;
};

const assertMoveUpItem = (data: VariablesData[]) => {
  const variables = [...data];
  e2e.pages.Dashboard.Settings.Variables.List.tableRowArrowUpButtons(variables[1].name).click();
  const temp = { ...variables[0] };
  variables[0] = { ...variables[1] };
  variables[1] = temp;
  e2e.pages.Dashboard.Settings.Variables.List.table().within(() => {
    e2e()
      .get('tbody > tr')
      .eq(0)
      .within(() => {
        e2e()
          .get('td')
          .eq(0)
          .contains(variables[0].name);
        e2e()
          .get('td')
          .eq(1)
          .contains(variables[0].query);
      });
    e2e()
      .get('tbody > tr')
      .eq(1)
      .within(() => {
        e2e()
          .get('td')
          .eq(0)
          .contains(variables[1].name);
        e2e()
          .get('td')
          .eq(1)
          .contains(variables[1].query);
      });
  });

  e2e.components.BackButton.backArrow()
    .should('be.visible')
    .click();

  assertVariableLabelsAndComponents(variables);

  return variables;
};
