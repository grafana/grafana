require('./commands');
require('./assertions');

Cypress.Screenshot.defaults({
  screenshotOnRunFailure: false,
});

const COMMAND_DELAY = 1000;

function delay(ms) {
  let now = Date.now();
  const end = now + ms;

  do {
    now = Date.now();
  } while (now < end);
}

if (Cypress.env('SLOWMO')) {
  Cypress.Commands.overwriteQuery('contains', function (contains, filter, text, userOptions = {}) {
    delay(COMMAND_DELAY);
    const call = contains.bind(this);
    return call(filter, text, userOptions);
  });

  const commandsToModify = ['clear', 'click', 'reload', 'then', 'trigger', 'type', 'visit'];
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
const featureToggles = ['kubernetesDashboards', 'dashboardNewLayouts', 'dashboardScene', 'groupByVariable'];

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

afterEach(() => {
  // in slowmo mode, wait to see the last command
  if (Cypress.env('SLOWMO')) {
    cy.wait(COMMAND_DELAY);
  }
});
