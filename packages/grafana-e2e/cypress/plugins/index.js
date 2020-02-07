const cypressTypeScriptPreprocessor = require('./cy-ts-preprocessor');
const compareSnapshotsPlugin = require('./cy-compare-images');

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
    log(args) {
      args.optional ? console.log(args.message, args.optional) : console.log(args.message);
      return null;
    },
  });
};
