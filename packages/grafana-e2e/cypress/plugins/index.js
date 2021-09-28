const fs = require('fs');
const path = require('path');

const compareScreenshots = require('./compareScreenshots');
const extendConfig = require('./extendConfig');
const readProvisions = require('./readProvisions');
const typescriptPreprocessor = require('./typescriptPreprocessor');

module.exports = (on, config) => {
  on('file:preprocessor', typescriptPreprocessor);
  on('task', { compareScreenshots, readProvisions });
  on('task', {
    log({ message, optional }) {
      optional ? console.log(message, optional) : console.log(message);
      return null;
    },
  });
  on('task', {
    getJSONFiles: async ({ dirPath }) => {
      const directoryPath = path.join(__dirname, dirPath);
      console.log(`Attempting to read contents of directory: ${directoryPath}`);
      const jsonFiles = fs.readdirSync(directoryPath);
      return jsonFiles.map((fileName) => {
        const fileBuffer = fs.readFileSync(path.join(directoryPath, fileName));
        return JSON.parse(fileBuffer);
      });
    },
  });

  // Always extend with this library's config and return for diffing
  // @todo remove this when possible: https://github.com/cypress-io/cypress/issues/5674
  return extendConfig(config);
};
