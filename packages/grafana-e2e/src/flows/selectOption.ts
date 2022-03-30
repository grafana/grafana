import { e2e } from '../index';

export interface SelectOptionConfig {
  clickToOpen?: boolean;
  container: any;
  forceClickOption?: boolean;
  optionText: string | RegExp;
}

// @todo this actually returns type `Cypress.Chainable`
export const selectOption = (config: SelectOptionConfig): any => {
  const fullConfig: SelectOptionConfig = {
    clickToOpen: true,
    forceClickOption: false,
    ...config,
  };

  const { clickToOpen, container, forceClickOption, optionText } = fullConfig;

  container.within(() => {
    if (clickToOpen) {
      e2e().get('[class$="-input-suffix"]').click();
    }
  });

  return e2e.components.Select.option()
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
    .click({ force: forceClickOption });
};
