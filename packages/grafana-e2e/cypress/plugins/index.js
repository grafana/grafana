const compareSnapshotsPlugin = require('./cy-compare-images');
const cypressTypeScriptPreprocessor = require('./cy-ts-preprocessor');

module.exports = on => {
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
};
