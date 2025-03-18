import { e2e } from '../utils';

describe('Panel edit tests - transformations', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Tests transformations editor', () => {
    e2e.flows.openDashboard({ uid: 'TkZXxlNG3', queryParams: { editPanel: 47 } });

    e2e.components.Tab.title('Transformations').should('be.visible').click();
    e2e.components.Transforms.addTransformationButton().scrollIntoView().should('be.visible').click();
    e2e.components.TransformTab.newTransform('Reduce').scrollIntoView().should('be.visible').click();
    e2e.components.Transforms.Reduce.calculationsLabel().scrollIntoView().should('be.visible');
    e2e.components.Transforms.Reduce.modeLabel().should('be.visible');
  });

  it('Tests case where transformations can be disabled and not clear out panel data', () => {
    e2e.flows.openDashboard({ uid: 'TkZXxlNG3', queryParams: { editPanel: 47 } });

    e2e.components.Tab.title('Transformations').should('be.visible').click();
    e2e.components.Transforms.addTransformationButton().scrollIntoView().should('be.visible').click();
    e2e.components.TransformTab.newTransform('Reduce').scrollIntoView().should('be.visible').click();
    e2e.components.Transforms.disableTransformationButton().should('be.visible').click();

    e2e.components.Panels.Panel.PanelDataErrorMessage().should('not.exist');
  });
});
