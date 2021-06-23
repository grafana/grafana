const compareScreenshots = require('./compareScreenshots');
const extendConfig = require('./extendConfig');
const readProvisions = require('./readProvisions');
const typescriptPreprocessor = require('./typescriptPreprocessor');
const { pa11y, prepareAudit } = require('cypress-audit');

module.exports = (on, config) => {
  on('file:preprocessor', typescriptPreprocessor);
  on('task', { compareScreenshots, readProvisions });
  on('task', {
    log({ message, optional }) {
      optional ? console.log(message, optional) : console.log(message);
      return null;
    },
  });
  on('before:browser:launch', (browser = {}, launchOptions) => {
    prepareAudit(launchOptions);
  });

  on('task', {
    pa11y: pa11y((pa11yReport) => {
      console.log(pa11yReport); // raw pa11y reports
    }),
  });

  // Always extend with this library's config and return for diffing
  // @todo remove this when possible: https://github.com/cypress-io/cypress/issues/5674
  return extendConfig(config);
};
