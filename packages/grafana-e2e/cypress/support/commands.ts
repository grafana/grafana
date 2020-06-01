interface CompareSceenshotsConfig {
  name: string;
  threshold?: number;
}

Cypress.Commands.add('compareSceenshots', (config: CompareSceenshotsConfig | string) => {
  cy.task('compareSceenshots', {
    config,
    screenshotsFolder: Cypress.config('screenshotsFolder'),
    specName: Cypress.spec.name,
  });
});

// @todo remove
Cypress.Commands.add('logToConsole', (message: string, optional?: any) => {
  cy.task('log', { message, optional });
});

Cypress.Commands.add('readProvisions', (filePaths: string[]) => {
  cy.task('readProvisions', {
    CWD: Cypress.env('CWD'),
    filePaths,
  });
});
