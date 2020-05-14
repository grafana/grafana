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
  for (const command of ['visit', 'click', 'trigger', 'type', 'clear', 'reload', 'contains', 'then']) {
    Cypress.Commands.overwrite(command, (originalFn, ...args) => {
      const origVal = originalFn(...args);

      return new Promise(resolve => {
        setTimeout(() => {
          resolve(origVal);
        }, COMMAND_DELAY);
      });
    });
  }
}

// uncomment below to prevent Cypress from failing tests when unhandled errors are thrown
// Cypress.on('uncaught:exception', (err, runnable) => {
//   // returning false here prevents Cypress from
//   // failing the test
//   return false;
// });
