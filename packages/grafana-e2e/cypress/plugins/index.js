const compareSnapshotsPlugin = require('./compareSnapshots');
const extendConfig = require('./extendConfig');
const readProvisions = require('./readProvisions');
const typescriptPreprocessor = require('./typescriptPreprocessor');
const { install: installConsoleLogger } = require('cypress-log-to-output');

module.exports = (on, config) => {
  on('file:preprocessor', typescriptPreprocessor);
  on('task', { compareSnapshotsPlugin, readProvisions });
  on('task', {
    // @todo remove
    log({ message, optional }) {
      optional ? console.log(message, optional) : console.log(message);
      return null;
    },
  });

  installConsoleLogger(on);

  // Always extend with this library's config and return for diffing
  // @todo remove this when possible: https://github.com/cypress-io/cypress/issues/5674
  return extendConfig(config);
};
