import { e2e } from '../index';

// @todo this actually returns type `Cypress.Chainable`
const get = (key: string): any =>
  e2e()
    .wrap({ getLocalStorage: () => localStorage.getItem(key) })
    .invoke('getLocalStorage');

// @todo this actually returns type `Cypress.Chainable`
export const getLocalStorage = (key: string): any =>
  get(key).then((value: any) => {
    if (value === null) {
      return value;
    } else {
      return JSON.parse(value);
    }
  });

// @todo this actually returns type `Cypress.Chainable`
export const requireLocalStorage = (key: string): any =>
  get(key) // `getLocalStorage()` would turn 'null' into `null`
    .should('not.equal', null)
    .then((value: any) => JSON.parse(value as string));
