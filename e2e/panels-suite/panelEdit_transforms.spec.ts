import { e2e } from '../utils';

describe('Panel edit tests - transformations', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Tests transformations editor', () => {
    e2e.flows.openDashboard({ uid: '5SdHCadmz', queryParams: { editPanel: 3 } });

    e2e.components.Tab.title('Transform').should('be.visible').click();
    e2e.components.TransformTab.newTransform('Reduce').scrollIntoView().should('be.visible').click();
    e2e.components.Transforms.Reduce.calculationsLabel().should('be.visible');
  });
});
