import { e2e } from '../utils';

describe('Dashboard', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can switch to auto grid layout', () => {
    e2e.flows.scenes.importV2Dashboard({ title: 'Switch to auto grid' });

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    e2e.components.OptionsGroup.toggle('grid-layout-category').click();

    e2e.flows.scenes.selectAutoGridLayout();

    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    const checkInputs = () => {
      e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.minColumnWidth().should('be.visible');
      e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.maxColumns().should('be.visible');
      e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.rowHeight().should('be.visible');
      e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.fillScreen().should('exist');
    };

    checkInputs();

    e2e.flows.scenes.saveDashboard();
    cy.reload();

    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    e2e.components.NavToolbar.editDashboard.editButton().click();

    checkInputs();
  });

  it('can change min column width in auto grid layout', () => {
    e2e.flows.scenes.importV2Dashboard({ title: 'Set min column width' });

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    e2e.components.OptionsGroup.toggle('grid-layout-category').click();

    e2e.flows.scenes.selectAutoGridLayout();

    let firstStandardPanelTopOffset = 0;

    // standard min column width will have 1 panel on a second row in edit mode
    e2e.components.Panels.Panel.title('New panel')
      .first()
      .then((el) => {
        firstStandardPanelTopOffset = el.offset().top;
      });

    e2e.components.Panels.Panel.title('New panel')
      .last()
      .then((el) => {
        expect(el.offset().top).to.be.greaterThan(firstStandardPanelTopOffset);
      });

    e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.minColumnWidth().should('be.visible').click();
    cy.get('[id=combobox-option-narrow]').click();

    const checkOffset = () => {
      // narrow min column width will have all panels on the same row
      let narrowPanelTopOffset = 0;

      e2e.components.Panels.Panel.title('New panel')
        .first()
        .then((el) => {
          narrowPanelTopOffset = el.offset().top;
        });

      e2e.components.Panels.Panel.title('New panel')
        .last()
        .then((el) => {
          expect(el.offset().top).to.eq(narrowPanelTopOffset);
        });
    };

    checkOffset();

    e2e.flows.scenes.saveDashboard();
    cy.reload();

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.minColumnWidth().should('have.value', 'Narrow');

    checkOffset();
  });

  it('can change to custom min column width in auto grid layout', () => {
    e2e.flows.scenes.importV2Dashboard({ title: 'Set custom min column width' });

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    e2e.components.OptionsGroup.toggle('grid-layout-category').click();

    e2e.flows.scenes.selectAutoGridLayout();

    e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.minColumnWidth().should('be.visible').click();
    cy.get('[id=combobox-option-custom]').click();

    e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.customMinColumnWidth()
      .should('be.visible')
      .clear()
      .type('900')
      .blur();

    cy.wait(100); // cy too fast and executes next command before resizing is done

    // // changing to 900 custom width to have each panel span the whole row to verify offset
    e2e.flows.scenes.verifyPanelsStackedVertically();

    e2e.flows.scenes.saveDashboard();
    cy.reload();

    e2e.flows.scenes.verifyPanelsStackedVertically();

    e2e.components.NavToolbar.editDashboard.editButton().click();
    e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.customMinColumnWidth().should('have.value', '900');

    e2e.flows.scenes.verifyPanelsStackedVertically();

    e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.clearCustomMinColumnWidth().should('be.visible').click();
    e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.minColumnWidth().should('have.value', 'Standard');
  });

  it('can change max columns in auto grid layout', () => {
    e2e.flows.scenes.importV2Dashboard({ title: 'Set max columns' });

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    e2e.components.OptionsGroup.toggle('grid-layout-category').click();

    e2e.flows.scenes.selectAutoGridLayout();

    e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.maxColumns().should('be.visible').click();
    cy.get('[id=combobox-option-1]').click();

    // changing to 1 max column to have each panel span the whole row to verify offset
    e2e.flows.scenes.verifyPanelsStackedVertically();

    e2e.flows.scenes.saveDashboard();
    cy.reload();

    e2e.flows.scenes.verifyPanelsStackedVertically();

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.maxColumns().should('have.value', '1');

    e2e.flows.scenes.verifyPanelsStackedVertically();
  });

  it('can change row height in auto grid layout', () => {
    e2e.flows.scenes.importV2Dashboard({ title: 'Set row height' });

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    e2e.components.OptionsGroup.toggle('grid-layout-category').click();

    e2e.flows.scenes.selectAutoGridLayout();

    let regularRowHeight = 0;

    e2e.components.Panels.Panel.title('New panel')
      .first()
      .then((el) => {
        regularRowHeight = el.height();
      });

    e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.rowHeight().should('be.visible').click();
    cy.get('[id=combobox-option-short]').click();

    e2e.components.Panels.Panel.title('New panel')
      .first()
      .then((el) => {
        expect(el.height()).to.be.lessThan(regularRowHeight);
      });

    e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.rowHeight().should('be.visible').click();
    cy.get('[id=combobox-option-tall]').click();

    const checkHeight = () => {
      e2e.components.Panels.Panel.title('New panel')
        .first()
        .then((el) => {
          expect(el.height()).to.be.greaterThan(regularRowHeight);
        });
    };

    checkHeight();

    e2e.flows.scenes.saveDashboard();
    cy.reload();

    checkHeight();

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.rowHeight().should('have.value', 'Tall');

    checkHeight();
  });

  it('can change to custom row height in auto grid layout', () => {
    e2e.flows.scenes.importV2Dashboard({ title: 'Set custom row height' });

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    e2e.components.OptionsGroup.toggle('grid-layout-category').click();

    e2e.flows.scenes.selectAutoGridLayout();

    let regularRowHeight = 0;

    e2e.components.Panels.Panel.title('New panel')
      .first()
      .then((el) => {
        regularRowHeight = el.height();
      });

    e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.rowHeight().should('be.visible').click();
    cy.get('[id=combobox-option-custom]').click();
    e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.customRowHeight().clear().type('800').blur();
    cy.wait(100); // cy too fast and executes next command before resizing is done

    e2e.components.Panels.Panel.title('New panel')
      .first()
      .then((el) => {
        const elHeight = el.height();
        expect(elHeight).be.closeTo(800, 5); // some flakyness and get 798 sometimes
        expect(elHeight).to.be.greaterThan(regularRowHeight);
      });

    e2e.flows.scenes.saveDashboard();
    cy.reload();

    e2e.components.Panels.Panel.title('New panel')
      .first()
      .then((el) => {
        expect(el.height()).be.closeTo(800, 5); // some flakyness and get 798 sometimes
      });

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.customRowHeight().should('have.value', '800');
    e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.clearCustomRowHeight().should('be.visible').click();
    e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.rowHeight().should('have.value', 'Standard');
  });

  it('can change fill screen in auto grid layout', () => {
    e2e.flows.scenes.importV2Dashboard({ title: 'Set fill screen' });

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    e2e.components.OptionsGroup.toggle('grid-layout-category').click();

    e2e.flows.scenes.selectAutoGridLayout();

    e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.minColumnWidth().should('be.visible').click();
    cy.get('[id=combobox-option-narrow]').click();

    let initialHeight = 0;

    e2e.components.Panels.Panel.title('New panel')
      .first()
      .then((el) => {
        initialHeight = el.height();
      });

    e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.fillScreen().click({ force: true });

    const checkHeight = () => {
      e2e.components.Panels.Panel.title('New panel')
        .first()
        .then((el) => {
          expect(el.height()).to.be.greaterThan(initialHeight);
        });
    };

    checkHeight();
    e2e.flows.scenes.saveDashboard();
    cy.reload();

    checkHeight();
    e2e.components.NavToolbar.editDashboard.editButton().click();
    e2e.components.PanelEditor.ElementEditPane.AutoGridLayout.fillScreen().should('be.checked');

    checkHeight();
  });
});
