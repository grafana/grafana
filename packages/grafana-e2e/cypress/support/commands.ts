import 'cypress-file-upload';

interface CompareScreenshotsConfig {
  name: string;
  threshold?: number;
}

Cypress.Commands.add('compareScreenshots', (config: CompareScreenshotsConfig | string) => {
  cy.task('compareScreenshots', {
    config,
    screenshotsFolder: Cypress.config('screenshotsFolder'),
    specName: Cypress.spec.name,
  });
});

Cypress.Commands.add('logToConsole', (message: string, optional?: any) => {
  cy.task('log', { message: '(' + new Date().toISOString() + ') ' + message, optional });
});

Cypress.Commands.add('readProvisions', (filePaths: string[]) => {
  cy.task('readProvisions', {
    CWD: Cypress.env('CWD'),
    filePaths,
  });
});

Cypress.Commands.add('getJSONFilesFromDir', (dirPath: string) => {
  return cy.task('getJSONFilesFromDir', {
    // CWD is set for plugins in the cli but not for the main grafana repo: https://github.com/grafana/grafana/blob/main/packages/grafana-e2e/cli.js#L12
    projectPath: Cypress.env('CWD') || Cypress.config().parentTestsFolder,
    relativePath: dirPath,
  });
});

Cypress.Commands.add('startBenchmarking', (testName: string) => {
  return cy.task('startBenchmarking', { testName });
});

Cypress.Commands.add('stopBenchmarking', (testName: string, appStats: Record<string, unknown>) => {
  return cy.task('stopBenchmarking', { testName, appStats });
});
