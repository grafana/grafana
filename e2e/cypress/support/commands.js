import 'cypress-file-upload';

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
  cy.task('readProvisions', {
    CWD: Cypress.env('CWD'),
    filePaths,
  });
});

Cypress.Commands.add('getJSONFilesFromDir', (dirPath) => {
  return cy.task('getJSONFilesFromDir', {
    // CWD is set for plugins in the cli but not for the main grafana repo: https://github.com/grafana/grafana/blob/main/packages/grafana-e2e/cli.js#L12
    projectPath: Cypress.env('CWD') || Cypress.config().parentTestsFolder,
    relativePath: dirPath,
  });
});

Cypress.Commands.add('startBenchmarking', (testName) => {
  return cy.task('startBenchmarking', { testName });
});

Cypress.Commands.add('stopBenchmarking', (testName, appStats) => {
  return cy.task('stopBenchmarking', { testName, appStats });
});
