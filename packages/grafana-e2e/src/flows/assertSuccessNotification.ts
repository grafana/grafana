export const assertSuccessNotification = () => {
  cy.get('.alert-success').should('exist');
};
