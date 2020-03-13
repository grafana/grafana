'use strict';
const {
  promises: { readFile },
} = require('fs');
const { resolve } = require('path');

module.exports = async baseConfig => {
  // From CLI
  const {
    env: { CWD },
  } = baseConfig;

  if (CWD) {
    const projectConfig = {
      integrationFolder: `${CWD}/cypress/integration`,
      screenshotsFolder: `${CWD}/cypress/screenshots`,
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
          return null;
        } else {
          // Unexpected error
          throw error;
        }
      });

    return { ...baseConfig, ...projectConfig, ...customProjectConfig };
  } else {
    // Temporary legacy support for Grafana core (using `yarn start`)
    return baseConfig;
  }
};
