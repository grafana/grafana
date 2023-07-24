const fs = require('fs');
const path = require('path');

const benchmarkPlugin = require('./benchmark');
const compareScreenshots = require('./compareScreenshots');
const extendConfig = require('./extendConfig');
const readProvisions = require('./readProvisions');
const typescriptPreprocessor = require('./typescriptPreprocessor');

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

  // Make recordings higher resolution
  // https://www.cypress.io/blog/2021/03/01/generate-high-resolution-videos-and-screenshots/
  on('before:browser:launch', (browser = {}, launchOptions) => {
    console.log('launching browser %s is headless? %s', browser.name, browser.isHeadless);

    // the browser width and height we want to get
    // our screenshots and videos will be of that resolution
    const width = 1920;
    const height = 1080;

    console.log('setting the browser window size to %d x %d', width, height);

    if (browser.name === 'chrome' && browser.isHeadless) {
      launchOptions.args.push(`--window-size=${width},${height}`);

      // force screen to be non-retina and just use our given resolution
      launchOptions.args.push('--force-device-scale-factor=1');
    }

    if (browser.name === 'electron' && browser.isHeadless) {
      // might not work on CI for some reason
      launchOptions.preferences.width = width;
      launchOptions.preferences.height = height;
    }

    if (browser.name === 'firefox' && browser.isHeadless) {
      launchOptions.args.push(`--width=${width}`);
      launchOptions.args.push(`--height=${height}`);
    }

    // IMPORTANT: return the updated browser launch options
    return launchOptions;
  });

  // Always extend with this library's config and return for diffing
  // @todo remove this when possible: https://github.com/cypress-io/cypress/issues/5674
  return extendConfig(config);
};
