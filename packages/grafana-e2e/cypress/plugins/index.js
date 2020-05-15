const compareSnapshotsPlugin = require('./compareSnapshots');
const extendConfig = require('./extendConfig');
const readProvisions = require('./readProvisions');
const typescriptPreprocessor = require('./typescriptPreprocessor');

module.exports = (on, config) => {
  // yarn build fails with:
  // >> /Users/hugo/go/src/github.com/grafana/grafana/node_modules/stringmap/stringmap.js:99
  // >>             throw new Error("StringMap expected string key");
  // on('task', {
  //   failed: require('cypress-failed-log/src/failed')(),
  // });
  on('file:preprocessor', typescriptPreprocessor);
  on('task', { compareSnapshotsPlugin, readProvisions });
  on('task', {
    log({ message, optional }) {
      optional ? console.log(message, optional) : console.log(message);
      return null;
    },
  });

  // Always extend with this library's config and return for diffing
  // @todo remove this when possible: https://github.com/cypress-io/cypress/issues/5674
  return extendConfig(config);
};
