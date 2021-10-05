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
    projectPath: Cypress.config().parentTestsFolder,
    relativePath: dirPath,
  });
});
