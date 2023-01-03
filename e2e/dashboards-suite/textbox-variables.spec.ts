import { e2e } from '@grafana/e2e';

const PAGE_UNDER_TEST = 'AejrN1AMz';

describe('TextBox - load options scenarios', function () {
  it('default options should be correct', function () {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}/templating-textbox-e2e-scenarios?orgId=1` });

    validateTextboxAndMarkup('default value');
  });

  it('loading variable from url should be correct', function () {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({
      uid: `${PAGE_UNDER_TEST}/templating-textbox-e2e-scenarios?orgId=1&var-text=not default value`,
    });

    validateTextboxAndMarkup('not default value');
  });
});

describe.skip('TextBox - change query scenarios', function () {
  it('when changing the query value and not saving current as default should revert query value', function () {
    copyExistingDashboard();

    changeQueryInput();

    e2e.components.BackButton.backArrow().should('be.visible').click({ force: true });

    validateTextboxAndMarkup('changed value');

    saveDashboard(false);

    e2e()
      .get<string>('@dashuid')
      .then((dashuid) => {
        expect(dashuid).not.to.eq(PAGE_UNDER_TEST);

        e2e.flows.openDashboard({ uid: dashuid });

        e2e().wait('@load-dash');

        validateTextboxAndMarkup('default value');

        validateVariable('changed value');
      });
  });

  it('when changing the query value and saving current as default should change query value', function () {
    copyExistingDashboard();

    changeQueryInput();

    e2e.components.BackButton.backArrow().should('be.visible').click({ force: true });

    validateTextboxAndMarkup('changed value');

    saveDashboard(true);

    e2e()
      .get<string>('@dashuid')
      .then((dashuid) => {
        expect(dashuid).not.to.eq(PAGE_UNDER_TEST);

        e2e.flows.openDashboard({ uid: dashuid });

        e2e().wait('@load-dash');

        validateTextboxAndMarkup('changed value');

        validateVariable('changed value');
      });
  });
});

describe.skip('TextBox - change picker value scenarios', function () {
  it('when changing the input value and not saving current as default should revert query value', function () {
    copyExistingDashboard();

    changeTextBoxInput();

    validateTextboxAndMarkup('changed value');

    saveDashboard(false);

    e2e()
      .get<string>('@dashuid')
      .then((dashuid) => {
        expect(dashuid).not.to.eq(PAGE_UNDER_TEST);

        e2e.flows.openDashboard({ uid: dashuid });

        e2e().wait('@load-dash');

        validateTextboxAndMarkup('default value');
        validateVariable('default value');
      });
  });

  it('when changing the input value and saving current as default should change query value', function () {
    copyExistingDashboard();

    changeTextBoxInput();

    validateTextboxAndMarkup('changed value');

    saveDashboard(true);

    e2e()
      .get<string>('@dashuid')
      .then((dashuid) => {
        expect(dashuid).not.to.eq(PAGE_UNDER_TEST);

        e2e.flows.openDashboard({ uid: dashuid });

        e2e().wait('@load-dash');

        validateTextboxAndMarkup('changed value');
        validateVariable('changed value');
      });
  });
});

function copyExistingDashboard() {
  e2e.flows.login('admin', 'admin');
  e2e()
    .intercept({
      method: 'GET',
      url: '/api/search?query=&type=dash-folder&permission=Edit',
    })
    .as('dash-settings');
  e2e()
    .intercept({
      method: 'POST',
      url: '/api/dashboards/db/',
    })
    .as('save-dash');
  e2e()
    .intercept({
      method: 'GET',
      url: /\/api\/dashboards\/uid\/(?!AejrN1AMz)\w+/,
    })
    .as('load-dash');
  e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}/templating-textbox-e2e-scenarios?orgId=1&editview=settings` });

  e2e().wait('@dash-settings');

  e2e.pages.Dashboard.Settings.General.saveAsDashBoard().should('be.visible').click();

  e2e.pages.SaveDashboardAsModal.newName().should('be.visible').type(`${Date.now()}`);

  e2e.pages.SaveDashboardAsModal.save().should('be.visible').click();

  e2e().wait('@save-dash');
  e2e().wait('@load-dash');

  e2e.pages.Dashboard.SubMenu.submenuItem().should('be.visible');

  e2e()
    .location()
    .then((loc) => {
      const dashuid = /\/d\/(\w+)\//.exec(loc.href)![1];
      e2e().wrap(dashuid).as('dashuid');
    });

  e2e().wait(500);
}

function saveDashboard(saveVariables: boolean) {
  e2e.components.PageToolbar.item('Save dashboard').should('be.visible').click();

  if (saveVariables) {
    e2e.pages.SaveDashboardModal.saveVariables().should('exist').click({ force: true });
  }

  e2e.pages.SaveDashboardModal.save().should('be.visible').click();

  e2e().wait('@save-dash');
}

function validateTextboxAndMarkup(value: string) {
  e2e.pages.Dashboard.SubMenu.submenuItem()
    .should('be.visible')
    .within(() => {
      e2e.pages.Dashboard.SubMenu.submenuItemLabels('text').should('be.visible');
      e2e().get('input').should('be.visible').should('have.value', value);
    });

  e2e.components.Panels.Visualization.Text.container()
    .should('be.visible')
    .within(() => {
      e2e().get('h1').should('be.visible').should('have.text', `variable: ${value}`);
    });
}

function validateVariable(value: string) {
  e2e.components.PageToolbar.item('Dashboard settings').should('be.visible').click();

  e2e.pages.Dashboard.Settings.General.sectionItems('Variables').should('be.visible').click();

  e2e.pages.Dashboard.Settings.Variables.List.tableRowNameFields('text').should('be.visible').click();

  e2e.pages.Dashboard.Settings.Variables.Edit.TextBoxVariable.textBoxOptionsQueryInputV2()
    .should('be.visible')
    .should('have.value', value);
}

function changeTextBoxInput() {
  e2e.pages.Dashboard.SubMenu.submenuItemLabels('text').should('be.visible');
  e2e.pages.Dashboard.SubMenu.submenuItem()
    .should('be.visible')
    .within(() => {
      e2e()
        .get('input')
        .should('be.visible')
        .should('have.value', 'default value')
        .clear()
        .type('changed value')
        .type('{enter}');
    });

  e2e()
    .location()
    .should((loc) => {
      expect(loc.search).to.contain('var-text=changed%20value');
    });
}

function changeQueryInput() {
  e2e.components.PageToolbar.item('Dashboard settings').should('be.visible').click();

  e2e.pages.Dashboard.Settings.General.sectionItems('Variables').should('be.visible').click();

  e2e.pages.Dashboard.Settings.Variables.List.tableRowNameFields('text').should('be.visible').click();

  e2e.pages.Dashboard.Settings.Variables.Edit.TextBoxVariable.textBoxOptionsQueryInputV2()
    .should('be.visible')
    .clear()
    .type('changed value')
    .blur();

  e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption()
    .should('have.length', 1)
    .should('have.text', 'changed value');
}
