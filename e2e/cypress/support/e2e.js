require('./commands');

Cypress.Screenshot.defaults({
  screenshotOnRunFailure: false,
});

const COMMAND_DELAY = 1000;

if (Cypress.env('SLOWMO')) {
  const commandsToModify = ['clear', 'click', 'contains', 'reload', 'then', 'trigger', 'type', 'visit'];

  commandsToModify.forEach((command) => {
    // @ts-ignore -- https://github.com/cypress-io/cypress/issues/7807
    Cypress.Commands.overwrite(command, (originalFn, ...args) => {
      const origVal = originalFn(...args);

      return new Promise((resolve) => {
        setTimeout(() => resolve(origVal), COMMAND_DELAY);
      });
    });
  });
}

// @todo remove when possible: https://github.com/cypress-io/cypress/issues/95
Cypress.on('window:before:load', (win) => {
  // @ts-ignore
  delete win.fetch;
});

// See https://github.com/quasarframework/quasar/issues/2233 for details
const resizeObserverLoopErrRe = /^[^(ResizeObserver loop limit exceeded)]/;
Cypress.on('uncaught:exception', (err) => {
  /* returning false here prevents Cypress from failing the test */
  if (resizeObserverLoopErrRe.test(err.message)) {
    return false;
  }
  return true;
});

// uncomment below to prevent Cypress from failing tests when unhandled errors are thrown
// Cypress.on('uncaught:exception', (err, runnable) => {
//   // returning false here prevents Cypress from
//   // failing the test
//   return false;
// });
//

// TODO: read from toggles_gen.csv?
const featureToggles = ['kubernetesDashboards', 'dashboardNewLayouts', 'dashboardScene'];

beforeEach(() => {
  let toggles = [];

  for (const toggle of featureToggles) {
    const toggleValue = Cypress.env(toggle);
    if (toggleValue !== undefined) {
      cy.logToConsole(`setting ${toggle} to ${toggleValue} in localstorage`);
      toggles.push(`${toggle}=${toggleValue}`);
    }
  }

  if (toggles.length > 0) {
    cy.logToConsole('setting feature toggles in localstorage');
    cy.setLocalStorage('grafana.featureToggles', toggles.join(','));
  }
});
