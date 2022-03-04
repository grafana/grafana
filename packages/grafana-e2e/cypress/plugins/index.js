const fs = require('fs');
const path = require('path');

const compareScreenshots = require('./compareScreenshots');
const extendConfig = require('./extendConfig');
const readProvisions = require('./readProvisions');
const typescriptPreprocessor = require('./typescriptPreprocessor');
const benchmarkPlugin = require('./benchmark');

module.exports = (on, config) => {
  if (config.env['BENCHMARK_PLUGIN_ENABLED'] === true) {
    benchmarkPlugin.initialize(on, config);
  }

  on('file:preprocessor', typescriptPreprocessor);
  on('task', { compareScreenshots, readProvisions });
  on('task', {
    log({ message, optional }) {
      optional ? console.log(message, optional) : console.log(message);
      return null;
    },
  });
  on('task', {
    getJSONFilesFromDir: async ({ projectPath, relativePath }) => {
      const directoryPath = path.join(projectPath, relativePath);
      const jsonFiles = fs.readdirSync(directoryPath);
      return jsonFiles
        .filter((fileName) => /.json$/i.test(fileName))
        .map((fileName) => {
          const fileBuffer = fs.readFileSync(path.join(directoryPath, fileName));
          return JSON.parse(fileBuffer);
        });
    },
  });

  // Always extend with this library's config and return for diffing
  // @todo remove this when possible: https://github.com/cypress-io/cypress/issues/5674
  return extendConfig(config);
};
