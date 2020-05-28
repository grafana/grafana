'use strict';
const {
  promises: { readFile },
} = require('fs');
const { resolve } = require('path');

// @todo use https://github.com/bahmutov/cypress-extends when possible
module.exports = async baseConfig => {
  // From CLI
  const {
    env: { CWD, UPDATE_SCREENSHOTS },
  } = baseConfig;

  if (CWD) {
    // @todo: https://github.com/cypress-io/cypress/issues/6406
    const jsonReporter = require.resolve('@mochajs/json-file-reporter');

    const projectConfig = {
      fixturesFolder: `${CWD}/cypress/fixtures`,
      integrationFolder: `${CWD}/cypress/integration`,
      reporter: jsonReporter,
      reporterOptions: {
        output: `${CWD}/cypress/report.json`,
      },
      screenshotsFolder: `${CWD}/cypress/screenshots/${UPDATE_SCREENSHOTS ? 'expected' : 'actual'}`,
      videosFolder: `${CWD}/cypress/videos`,
    };

    const customProjectConfig = await readFile(`${CWD}/cypress.json`, 'utf8')
      .then(JSON.parse)
      .then(config => {
        const pathKeys = [
          'fileServerFolder',
          'fixturesFolder',
          'ignoreTestFiles',
          'integrationFolder',
          'pluginsFile',
          'screenshotsFolder',
          'supportFile',
          'testFiles',
          'videosFolder',
        ];

        return Object.fromEntries(
          Object.entries(config).map(([key, value]) => {
            if (pathKeys.includes(key)) {
              return [key, resolve(CWD, value)];
            } else {
              return [key, value];
            }
          })
        );
      })
      .catch(error => {
        if (error.code === 'ENOENT') {
          // File is optional
          return {};
        } else {
          // Unexpected error
          throw error;
        }
      });

    return {
      ...baseConfig,
      ...projectConfig,
      ...customProjectConfig,
      reporterOptions: {
        ...baseConfig.reporterOptions,
        ...projectConfig.reporterOptions,
        ...customProjectConfig.reporterOptions,
      },
    };
  } else {
    // Temporary legacy support for Grafana core (using `yarn start`)
    return baseConfig;
  }
};
