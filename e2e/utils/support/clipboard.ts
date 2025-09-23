declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      copyToClipboard(): Chainable;
      copyFromClipboard(): Chainable;
    }
  }
}

Cypress.Commands.add('copyFromClipboard', () => {
  return cy.window().then((win) => {
    return cy.wrap(win.navigator.clipboard.readText());
  });
});

Cypress.Commands.add(
  'copyToClipboard',
  {
    prevSubject: [],
  },
  (subject: string) => {
    return cy.window().then((win) => {
      return cy.wrap(win.navigator.clipboard.writeText(subject));
    });
  }
);

export {};
