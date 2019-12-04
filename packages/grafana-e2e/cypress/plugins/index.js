const cypressTypeScriptPreprocessor = require('./cy-ts-preprocessor');

module.exports = on => {
  on('task', {
    failed: require('cypress-failed-log/src/failed')(),
  });
  on('file:preprocessor', cypressTypeScriptPreprocessor);
};
