import { e2e } from '../index';

// @todo this actually returns type `Cypress.Chainable`
export const selectOption = (select: any, optionText: string | RegExp, clickToOpen = true): any =>
  select.within(() => {
    if (clickToOpen) {
      e2e()
        .get('[class$="-input-suffix"]')
        .click();
    }

    e2e.components.Select.option()
      .filter((_, { textContent }) => {
        if (textContent === null) {
          return false;
        } else if (typeof optionText === 'string') {
          return textContent.includes(optionText);
        } else {
          return optionText.test(textContent);
        }
      })
      .scrollIntoView()
      .click();
    e2e()
      .root()
      .scrollIntoView();
  });
