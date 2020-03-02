const compareSnapshotsPlugin = require('./cy-compare-images');
const cypressTypeScriptPreprocessor = require('./cy-ts-preprocessor');
const extendConfigPlugin = require('./cy-extend-config');

module.exports = (on, config) => {
  // yarn build fails with:
  // >> /Users/hugo/go/src/github.com/grafana/grafana/node_modules/stringmap/stringmap.js:99
  // >>             throw new Error("StringMap expected string key");
  // on('task', {
  //   failed: require('cypress-failed-log/src/failed')(),
  // });
  on('file:preprocessor', cypressTypeScriptPreprocessor);
  on('task', {
    compareSnapshotsPlugin,
  });
  on('task', {
    log({ message, optional }) {
      optional ? console.log(message, optional) : console.log(message);
      return null;
    },
  });

  // Always extend with this library's config and return for diffing
  // @todo remove this when possible: https://github.com/cypress-io/cypress/issues/5674
  return extendConfigPlugin(config);
};
