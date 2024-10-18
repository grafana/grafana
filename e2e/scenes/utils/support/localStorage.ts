// @todo this actually returns type `Cypress.Chainable`
const get = (key: string) =>
  cy.wrap({ getLocalStorage: () => localStorage.getItem(key) }, { log: false }).invoke('getLocalStorage');

export const getLocalStorage = (key: string) =>
  get(key).then((value) => {
    if (value === null) {
      return value;
    } else {
      return JSON.parse(value);
    }
  });

export const requireLocalStorage = (key: string) =>
  get(key) // `getLocalStorage()` would turn 'null' into `null`
    .should('not.equal', null)
    .then((value) => JSON.parse(value));
