import { e2e } from '../index';

// @todo this actually returns type `Cypress.Chainable`
export const selectOption = (select: any, optionText: string): any =>
  select.within(() => {
    e2e()
      .get('[class$="-input-suffix"]')
      .click();
    e2e.components.Select.option()
      .filter(`:contains("${optionText}")`)
      .scrollIntoView()
      .click();
    e2e()
      .root()
      .scrollIntoView();
  });
