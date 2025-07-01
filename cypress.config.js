const { defineConfig } = require('cypress');
const fs = require('fs');
const path = require('path');

const benchmarkPlugin = require('./e2e/cypress/plugins/benchmark/index');
const readProvisions = require('./e2e/cypress/plugins/readProvisions');
const smtpTester = require('./e2e/cypress/plugins/smtpTester');
const typescriptPreprocessor = require('./e2e/cypress/plugins/typescriptPreprocessor');

module.exports = defineConfig({
  projectId: 'zb7k1c',
  videoCompression: 20,
  viewportWidth: 1920,
  viewportHeight: 1080,

  env: {
    LOG_SELECTORS_INFO: false,
  },
  e2e: {
    supportFile: './e2e/cypress/support/e2e.js',
    setupNodeEvents(on, config) {
      on('file:preprocessor', typescriptPreprocessor);
      on('task', {
        log({ message, optional }) {
          optional ? console.log(message, optional) : console.log(message);
          return null;
        },
      });

      if (config.env['BENCHMARK_PLUGIN_ENABLED'] === true) {
        benchmarkPlugin.initialize(on, config);
      }

      if (config.env['SMTP_PLUGIN_ENABLED'] === true) {
        smtpTester.initialize(on, config);
      }

      on('task', {
        readProvisions: (filePaths) => readProvisions({ CWD: process.cwd(), filePaths }),
      });

      on('task', {
        getJSONFilesFromDir: async ({ relativePath }) => {
          // CWD is set for plugins in the cli but not for the main grafana repo: https://github.com/grafana/grafana/blob/main/packages/grafana-e2e/cli.js#L12
          const projectPath = config.env.CWD || config.fileServerFolder || process.cwd();
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

      on('after:spec', (_, results) => {
        if (!results || !results.video || !results.tests) {
          return;
        }

        // Do we have failures for any retry attempts?
        const failures = results.tests.some((test) => test.attempts.some((attempt) => attempt.state === 'failed'));
        if (failures) {
          return;
        }

        // delete the video if the spec passed and no tests retried
        fs.unlinkSync(results.video);
      });
    },
  },
});
