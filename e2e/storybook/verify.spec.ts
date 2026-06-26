// very basic test to verify that the button story loads correctly
// this is only intended to catch some basic build errors with storybook
// NOTE: storybook must already be running (`yarn storybook`) for this test to work
describe('Verify storybook', () => {
  it('Loads the button story correctly', () => {
    cy.visit('?path=/story/buttons-button--basic');
    getIframeBody().find('button:contains("Example button")').should('be.visible');
  });
});

// see https://www.cypress.io/blog/2020/02/12/working-with-iframes-in-cypress
function getIframeBody() {
  return cy.get('#storybook-preview-iframe').its('0.contentDocument.body').should('not.be.empty').then(cy.wrap);
}
