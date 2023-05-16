require('cypress-file-upload');

Cypress.Commands.add('compareScreenshots', (config) => {
  cy.task('compareScreenshots', {
    config,
    screenshotsFolder: Cypress.config('screenshotsFolder'),
    specName: Cypress.spec.name,
  });
});

Cypress.Commands.add('logToConsole', (message, optional) => {
  cy.task('log', { message: '(' + new Date().toISOString() + ') ' + message, optional });
});

Cypress.Commands.add('readProvisions', (filePaths) => {
  cy.task('readProvisions', filePaths);
});

Cypress.Commands.add('getJSONFilesFromDir', (dirPath) => {
  return cy.task('getJSONFilesFromDir', dirPath);
});

Cypress.Commands.add('startBenchmarking', (testName) => {
  return cy.task('startBenchmarking', { testName });
});

Cypress.Commands.add('stopBenchmarking', (testName, appStats) => {
  return cy.task('stopBenchmarking', { testName, appStats });
});
