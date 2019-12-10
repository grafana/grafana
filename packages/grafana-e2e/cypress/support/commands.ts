interface CompareSnapshotArgs {
  pathToFileA: string;
  pathToFileB: string;
  threshold?: number;
}

Cypress.Commands.add('compareSnapshot', (args: CompareSnapshotArgs) => {
  cy.task('compareSnapshotsPlugin', args).then((results: any) => {
    if (results.code <= 1) {
      let msg = `\nThe screenshot:[${args.pathToFileA}] differs from :[${args.pathToFileB}]`;
      msg += '\n';
      msg += '\nCheck the Artifacts tab in the CircleCi build output for the actual screenshots.';
      msg += '\n';
      msg += '\n  If the difference between expected and outcome is NOT acceptable then do the following:';
      msg += '\n    - Check the code for changes that causes this difference, fix that and retry.';
      msg += '\n';
      msg += '\n  If the difference between expected and outcome is acceptable then do the following:';
      msg += '\n    - Replace the expected image with the outcome and retry.';
      msg += '\n';
      throw new Error(msg);
    }
  });
});

Cypress.Commands.add('logToConsole', (message: string, optional?: any) => {
  cy.task('log', { message, optional });
});
