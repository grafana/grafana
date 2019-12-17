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
  e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsDataSourceSelect().within(select => {
    e2e()
      .get('option:selected')
      .should('not.exist');
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
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalNameInput().type(name);
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInput().type(label);
  e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsDataSourceSelect()
    .select(`string:${dataSourceName}`)
    .blur();
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

const assertVariableTableRow = ({ name, query }: QueryVariableData) => {
  e2e.pages.Dashboard.Settings.Variables.List.tableRowNameFields(name)
    .should('exist')
    .contains(name);
  e2e.pages.Dashboard.Settings.Variables.List.tableRowDefinitionFields(name)
    .should('exist')
    .contains(query);
  e2e.pages.Dashboard.Settings.Variables.List.tableRowArrowUpButtons(name).should('exist');
  e2e.pages.Dashboard.Settings.Variables.List.tableRowArrowDownButtons(name).should('exist');
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
    assertVariableTableRow(args[index]);
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

    e2e.pages.Dashboard.Toolbar.toolbarItems('Dashboard settings').click();
    e2e.pages.Dashboard.Settings.General.sectionItems('Variables').click();
    e2e.pages.Dashboard.Settings.Variables.List.newButton().click();
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
  e2e.pages.Dashboard.Settings.General.sectionItems('General').click();
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
  assertVariableTableRow(newItem);
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
};

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

    const queryVariables: QueryVariableData[] = [
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

    assertAdding3dependantQueryVariablesScenario(queryVariables);

    // assert that duplicate works
    assertDuplicateItem(queryVariables);

    logSection('Asserting variable duplicate, OK!');
    // assert that delete works

    // assert that update works

    // assert that move down works

    // assert that move up works
  },
});
