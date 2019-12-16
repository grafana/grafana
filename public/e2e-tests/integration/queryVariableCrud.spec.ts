import { e2e } from '@grafana/e2e';

const assertDefaultsForNewVariable = () => {
  e2e().logToConsole('Asserting defaults for new variable');
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
  e2e().logToConsole('Asserting defaults for new variable, OK!');
};

interface CreateQueryVariableArguments {
  name: string;
  label: string;
  dataSourceName: string;
  query: string;
}

const createQueryVariable = ({ name, label, dataSourceName, query }: CreateQueryVariableArguments) => {
  e2e().logToConsole('Creating a Query Variable with', { name, label, dataSourceName, query });
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
  e2e().logToConsole('Creating a Query Variable with required, OK!');
};

const assertVariableTable = (args: Array<{ name: string; query: string }>) => {
  e2e().logToConsole('Asserting variable table with', args);
  e2e.pages.Dashboard.Settings.Variables.List.table()
    .should('be.visible')
    .within(() => {
      e2e()
        .get('tbody > tr')
        .should('have.length', args.length);
    });

  for (let index = 0; index < args.length; index++) {
    const { name, query } = args[index];
    e2e.pages.Dashboard.Settings.Variables.List.tableRowNameFields(name).should('exist');
    e2e.pages.Dashboard.Settings.Variables.List.tableRowDefinitionFields(name)
      .should('exist')
      .contains(query);
    e2e.pages.Dashboard.Settings.Variables.List.tableRowArrowUpButtons(name).should('exist');
    e2e.pages.Dashboard.Settings.Variables.List.tableRowArrowDownButtons(name).should('exist');
    e2e.pages.Dashboard.Settings.Variables.List.tableRowDuplicateButtons(name).should('exist');
    e2e.pages.Dashboard.Settings.Variables.List.tableRowRemoveButtons(name).should('exist');
  }

  e2e().logToConsole('Asserting variable table, Ok');
};

const assertVariableLabelsAndComponents = (
  args: Array<{ label: string; options: string[]; selectedOption: string }>
) => {
  e2e().logToConsole('Asserting variable components and labels');
  e2e.pages.Dashboard.SubMenu.submenuItem().should('have.length', args.length);
  for (let index = 0; index < args.length; index++) {
    const { label, options, selectedOption } = args[index];
    e2e.pages.Dashboard.SubMenu.submenuItemLabels(label).should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(selectedOption)
      .should('be.visible')
      .click();
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown().should('be.visible');
    for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
      e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts(options[optionIndex]).should('be.visible');
    }
  }
  e2e().logToConsole('Asserting variable components and labels, Ok');
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

    const queryVariables = [
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

    for (let queryVariableIndex = 0; queryVariableIndex < queryVariables.length; queryVariableIndex++) {
      const { name, label, query } = queryVariables[queryVariableIndex];
      const asserts = queryVariables.slice(0, queryVariableIndex + 1);
      createQueryVariable({
        dataSourceName: e2e.context().get('lastAddedDataSource'),
        name,
        label,
        query,
      });

      assertVariableTable(asserts);

      e2e.pages.Dashboard.Settings.General.saveDashBoard().click();
      e2e.pages.SaveDashboardModal.save().click();
      cl;
      e2e.flows.assertSuccessNotification();

      e2e.pages.Dashboard.Toolbar.backArrow().click();

      assertVariableLabelsAndComponents(asserts);

      e2e.pages.Dashboard.Toolbar.toolbarItems('Dashboard settings').click();
      e2e.pages.Dashboard.Settings.General.sectionItems('Variables').click();
      e2e.pages.Dashboard.Settings.Variables.List.newButton().click();
    }
  },
});
