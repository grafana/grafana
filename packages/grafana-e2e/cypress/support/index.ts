// yarn build fails with:
// >> /Users/hugo/go/src/github.com/grafana/grafana/node_modules/stringmap/stringmap.js:99
// >>             throw new Error("StringMap expected string key");
// require('cypress-failed-log');
import './commands';

Cypress.Screenshot.defaults({
  screenshotOnRunFailure: false,
});

const COMMAND_DELAY = 1000;

if (Cypress.env('SLOWMO')) {
  const commandsToModify = ['clear', 'click', 'contains', 'reload', 'then', 'trigger', 'type', 'visit'];

  commandsToModify.forEach(command => {
    // @ts-ignore -- https://github.com/cypress-io/cypress/issues/7807
    Cypress.Commands.overwrite(command, (originalFn, ...args) => {
      const origVal = originalFn(...args);

      return new Promise(resolve => {
        setTimeout(() => resolve(origVal), COMMAND_DELAY);
      });
    });
  });
}

// @todo remove when possible: https://github.com/cypress-io/cypress/issues/95
Cypress.on('window:before:load', win => {
  // @ts-ignore
  delete win.fetch;
});

// uncomment below to prevent Cypress from failing tests when unhandled errors are thrown
// Cypress.on('uncaught:exception', (err, runnable) => {
//   // returning false here prevents Cypress from
//   // failing the test
//   return false;
// });
