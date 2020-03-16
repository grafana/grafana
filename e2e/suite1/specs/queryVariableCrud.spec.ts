import { e2e } from '@grafana/e2e';

const assertDefaultsForNewVariable = () => {
  logSection('Asserting defaults for new variable');
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

  e2e()
    .window()
    .then((win: any) => {
      let chainer = 'not.exist';
      let value: string = undefined;
      if (win.grafanaBootData.settings.featureToggles.newVariables) {
        chainer = 'have.text';
        value = '';
      }

      e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsDataSourceSelect().within(select => {
        e2e()
          .get('option:selected')
          .should(chainer, value);
      });
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
  logSection('Asserting defaults for new variable, OK!');
};

interface CreateQueryVariableArguments extends QueryVariableData {
  dataSourceName: string;
}

const createQueryVariable = ({ name, label, dataSourceName, query }: CreateQueryVariableArguments) => {
  logSection('Creating a Query Variable with', { name, label, dataSourceName, query });
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalNameInput().should('be.visible');
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalNameInput().type(name);
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInput().type(label);
  e2e()
    .window()
    .then((win: any) => {
      let text = `string:${dataSourceName}`;
      if (win.grafanaBootData.settings.featureToggles.newVariables) {
        text = `${dataSourceName}`;
      }
      e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsDataSourceSelect()
        .select(text)
        .blur();
    });
  e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput()
    .within(input => {
      expect(input.attr('placeholder')).equals('metric name or tags query');
      expect(input.val()).equals('');
    })
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
  logSection('Creating a Query Variable with required, OK!');
};

const assertVariableTableRow = ({ name, query }: QueryVariableData, index: number, length: number) => {
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

const assertVariableTable = (args: QueryVariableData[]) => {
  logSection('Asserting variable table with', args);
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

  logSection('Asserting variable table, Ok');
};

const assertVariableLabelAndComponent = ({ label, options, selectedOption }: QueryVariableData) => {
  e2e.pages.Dashboard.SubMenu.submenuItemLabels(label).should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(selectedOption)
    .should('be.visible')
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown().should('be.visible');
  for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts(options[optionIndex]).should('be.visible');
  }
};

const assertVariableLabelsAndComponents = (args: QueryVariableData[]) => {
  logSection('Asserting variable components and labels');
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
  logSection('Asserting variable components and labels, Ok');
};

const assertAdding3dependantQueryVariablesScenario = (queryVariables: QueryVariableData[]) => {
  // This creates 3 variables where 2 depends on 1 and 3 depends on 2 and for each added variable
  // we assert that the variable looks ok in the variable list and that it looks ok in the submenu in dashboard
  for (let queryVariableIndex = 0; queryVariableIndex < queryVariables.length; queryVariableIndex++) {
    const { name, label, query, options, selectedOption } = queryVariables[queryVariableIndex];
    const asserts = queryVariables.slice(0, queryVariableIndex + 1);
    createQueryVariable({
      dataSourceName: e2e.context().get('lastAddedDataSource'),
      name,
      label,
      query,
      options,
      selectedOption,
    });

    assertVariableTable(asserts);

    e2e.pages.Dashboard.Settings.General.saveDashBoard().click();
    e2e.pages.SaveDashboardModal.save().click();
    e2e.flows.assertSuccessNotification();

    e2e.pages.Dashboard.Toolbar.backArrow().click();

    assertVariableLabelsAndComponents(asserts);

    if (queryVariableIndex < queryVariables.length - 1) {
      e2e.pages.Dashboard.Toolbar.toolbarItems('Dashboard settings').click();
      e2e.pages.Dashboard.Settings.General.sectionItems('Variables').click();
      e2e.pages.Dashboard.Settings.Variables.List.newButton().click();
    }
  }
};

interface QueryVariableData {
  name: string;
  query: string;
  label: string;
  options: string[];
  selectedOption: string;
}

const logSection = (message: string, args?: any) => {
  e2e().logToConsole('');
  e2e().logToConsole(message, args);
  e2e().logToConsole('===============================================================================');
};

const assertDuplicateItem = (queryVariables: QueryVariableData[]) => {
  logSection('Asserting variable duplicate');

  const itemToDuplicate = queryVariables[1];
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
        .should('have.length', queryVariables.length + 1);
    });
  const newItem = { ...itemToDuplicate, name: `copy_of_${itemToDuplicate.name}` };
  assertVariableTableRow(newItem, queryVariables.length - 1, queryVariables.length);
  e2e.pages.Dashboard.Settings.Variables.List.tableRowNameFields(newItem.name).click();

  newItem.label = `copy_of_${itemToDuplicate.label}`;
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInput()
    .clear()
    .type(newItem.label);

  e2e.pages.Dashboard.Settings.General.saveDashBoard().click();
  e2e.pages.SaveDashboardModal.save().click();
  e2e.flows.assertSuccessNotification();

  e2e.pages.Dashboard.Toolbar.backArrow().click();

  e2e.pages.Dashboard.SubMenu.submenuItemLabels(newItem.label).should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(newItem.selectedOption)
    .should('be.visible')
    .eq(1)
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown().should('be.visible');
  for (let optionIndex = 0; optionIndex < newItem.options.length; optionIndex++) {
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts(newItem.options[optionIndex]).should('be.visible');
  }

  logSection('Asserting variable duplicate, OK!');
  return [...queryVariables, newItem];
};

const assertDeleteItem = (queryVariables: QueryVariableData[]) => {
  logSection('Asserting variable delete');

  const itemToDelete = queryVariables[1];
  e2e.pages.Dashboard.Toolbar.toolbarItems('Dashboard settings').click();
  e2e.pages.Dashboard.Settings.General.sectionItems('Variables').click();

  e2e.pages.Dashboard.Settings.Variables.List.tableRowRemoveButtons(itemToDelete.name).click();
  e2e.pages.Dashboard.Settings.Variables.List.table()
    .should('be.visible')
    .within(() => {
      e2e()
        .get('tbody > tr')
        .should('have.length', queryVariables.length - 1);
    });

  e2e.pages.Dashboard.Settings.General.saveDashBoard().click();
  e2e.pages.SaveDashboardModal.save().click();
  e2e.flows.assertSuccessNotification();

  e2e.pages.Dashboard.Toolbar.backArrow().click();

  e2e.pages.Dashboard.SubMenu.submenuItemLabels(itemToDelete.label).should('not.exist');

  logSection('Asserting variable delete, OK!');

  return queryVariables.filter(item => item.name !== itemToDelete.name);
};

const assertUpdateItem = (data: QueryVariableData[]) => {
  const queryVariables = [...data];
  // updates an item to a constant variable instead
  const itemToUpdate = queryVariables[1];
  let updatedItem = {
    ...itemToUpdate,
    name: `update_of_${itemToUpdate.name}`,
    label: `update_of_${itemToUpdate.label}`,
    query: 'A constant',
    options: ['A constant'],
    selectedOption: 'undefined',
  };

  logSection('Asserting variable update');
  queryVariables[1] = updatedItem;

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

  e2e.pages.Dashboard.Toolbar.backArrow().click();

  e2e()
    .window()
    .then((win: any) => {
      if (win.grafanaBootData.settings.featureToggles.newVariables) {
        queryVariables[1].selectedOption = 'A constant';
      } else {
        queryVariables[1].selectedOption = 'undefined';
      }
      assertVariableLabelAndComponent(queryVariables[1]);
    });

  e2e.pages.Dashboard.Toolbar.toolbarItems('Dashboard settings').click();
  e2e.pages.Dashboard.Settings.General.sectionItems('Variables').click();

  assertVariableTableRow(queryVariables[1], 1, queryVariables.length);

  queryVariables[1].selectedOption = 'A constant';

  logSection('Asserting variable update, OK!');
  return queryVariables;
};

const assertMoveDownItem = (data: QueryVariableData[]) => {
  logSection('Asserting variable move down');
  const queryVariables = [...data];
  e2e.pages.Dashboard.Settings.Variables.List.tableRowArrowDownButtons(queryVariables[0].name).click();
  const temp = { ...queryVariables[0] };
  queryVariables[0] = { ...queryVariables[1] };
  queryVariables[1] = temp;
  e2e.pages.Dashboard.Settings.Variables.List.table().within(() => {
    e2e()
      .get('tbody > tr')
      .eq(0)
      .within(() => {
        e2e()
          .get('td')
          .eq(0)
          .contains(queryVariables[0].name);
        e2e()
          .get('td')
          .eq(1)
          .contains(queryVariables[0].query);
      });
    e2e()
      .get('tbody > tr')
      .eq(1)
      .within(() => {
        e2e()
          .get('td')
          .eq(0)
          .contains(queryVariables[1].name);
        e2e()
          .get('td')
          .eq(1)
          .contains(queryVariables[1].query);
      });
  });

  e2e.pages.Dashboard.Toolbar.backArrow().click();

  assertVariableLabelsAndComponents(queryVariables);

  logSection('Asserting variable move down, OK!');

  return queryVariables;
};

const assertSelects = (queryVariables: QueryVariableData[]) => {
  // Values in submenus should be
  // query1: [A] query2: [AA] query3: [AAA]
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A').click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A').click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('B').click();
  e2e.pages.Dashboard.Toolbar.navBar().click();
  // Values in submenus should be
  // query1: [B] query2: [All] query3: [All]
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All').should('have.length', 2);
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All')
    .eq(0)
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BA').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BB').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BC').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BB').click();
  e2e.pages.Dashboard.Toolbar.navBar().click();
  // Values in submenus should be
  // query1: [B] query2: [BB] query3: [All]
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All').should('have.length', 1);
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All')
    .eq(0)
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBA').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBB').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBC').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBB').click();
  e2e.pages.Dashboard.Toolbar.navBar().click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All').should('have.length', 0);
  // Values in submenus should be
  // query1: [B] query2: [BB] query3: [BBB]
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BB').click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BA').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BB').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BC').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BC').click();
  e2e.pages.Dashboard.Toolbar.navBar().click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BB + BC').should('have.length', 1);
  // Values in submenus should be
  // query1: [B] query2: [BB + BC] query3: [BBB]
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BBB').click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBA').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBB').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBC').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BCA').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BCB').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BCC').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BCC').click();
  e2e.pages.Dashboard.Toolbar.navBar().click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BBB + BCC').should('have.length', 1);
  // Values in submenus should be
  // query1: [B] query2: [BB + BC] query3: [BBB + BCC]
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BB + BC').click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BA').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BB').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BC').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BA').click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BB').click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BC').click();
  e2e.pages.Dashboard.Toolbar.navBar().click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BA').should('have.length', 1);
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All').should('have.length', 1);
  // Values in submenus should be
  // query1: [B] query2: [BA] query3: [All]
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('B').click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('B').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('C').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A').click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('B').click();
  e2e.pages.Dashboard.Toolbar.navBar().click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A').should('have.length', 1);
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All').should('have.length', 2);
  // Values in submenus should be
  // query1: [A] query2: [All] query3: [All]
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All')
    .eq(0)
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AA').click();
  e2e.pages.Dashboard.Toolbar.navBar().click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A').should('have.length', 1);
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('AA').should('have.length', 1);
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All').should('have.length', 1);
  // Values in submenus should be
  // query1: [A] query2: [AA] query3: [All]
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All')
    .eq(0)
    .click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AAA').click();
  e2e.pages.Dashboard.Toolbar.navBar().click();
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A').should('have.length', 1);
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('AA').should('have.length', 1);
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('AAA').should('have.length', 1);
  e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All').should('have.length', 0);
};

const assertMoveUpItem = (data: QueryVariableData[]) => {
  logSection('Asserting variable move up');
  const queryVariables = [...data];
  e2e.pages.Dashboard.Toolbar.toolbarItems('Dashboard settings').click();
  e2e.pages.Dashboard.Settings.General.sectionItems('Variables').click();

  e2e.pages.Dashboard.Settings.Variables.List.tableRowArrowUpButtons(queryVariables[1].name).click();
  const temp = { ...queryVariables[0] };
  queryVariables[0] = { ...queryVariables[1] };
  queryVariables[1] = temp;
  e2e.pages.Dashboard.Settings.Variables.List.table().within(() => {
    e2e()
      .get('tbody > tr')
      .eq(0)
      .within(() => {
        e2e()
          .get('td')
          .eq(0)
          .contains(queryVariables[0].name);
        e2e()
          .get('td')
          .eq(1)
          .contains(queryVariables[0].query);
      });
    e2e()
      .get('tbody > tr')
      .eq(1)
      .within(() => {
        e2e()
          .get('td')
          .eq(0)
          .contains(queryVariables[1].name);
        e2e()
          .get('td')
          .eq(1)
          .contains(queryVariables[1].query);
      });
  });

  e2e.pages.Dashboard.Toolbar.backArrow().click();

  assertVariableLabelsAndComponents(queryVariables);

  logSection('Asserting variable move up, OK!');

  return queryVariables;
};

// This test should really be broken into several smaller tests
e2e.scenario({
  describeName: 'Variables',
  itName: 'Query Variables CRUD',
  addScenarioDataSource: true,
  addScenarioDashBoard: true,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard(e2e.context().get('lastAddedDashboardUid'));
    e2e.pages.Dashboard.Toolbar.toolbarItems('Dashboard settings').click();
    e2e.pages.Dashboard.Settings.General.sectionItems('Variables').click();
    e2e.pages.Dashboard.Settings.Variables.List.addVariableCTA().click();

    assertDefaultsForNewVariable();

    e2e.pages.Dashboard.Settings.General.sectionItems('General').click();
    e2e.pages.Dashboard.Settings.General.sectionItems('Variables').click();
    e2e.pages.Dashboard.Settings.Variables.List.addVariableCTA().click();

    let queryVariables: QueryVariableData[] = [
      {
        name: 'query1',
        query: '*',
        label: 'query1-label',
        options: ['All', 'A', 'B', 'C'],
        selectedOption: 'A',
      },
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

    assertAdding3dependantQueryVariablesScenario(queryVariables);

    // assert select updates
    assertSelects(queryVariables);

    // assert that duplicate works
    queryVariables = assertDuplicateItem(queryVariables);

    // assert that delete works
    queryVariables = assertDeleteItem(queryVariables);

    // assert that update works
    queryVariables = assertUpdateItem(queryVariables);

    // assert that move down works
    queryVariables = assertMoveDownItem(queryVariables);

    // assert that move up works
    assertMoveUpItem(queryVariables);
  },
});
