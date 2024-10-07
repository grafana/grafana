const grafanaConfig = require('./jest.config');

module.exports = {
  ...grafanaConfig,
  roots: [
    '<rootDir>/public/app/percona',
    '<rootDir>/public/app/plugins/datasource/pmm-pt-summary-datasource',
    '<rootDir>/public/app/plugins/panel/pmm-check',
    '<rootDir>/public/app/plugins/panel/pmm-pt-summary-panel',
    '<rootDir>/public/app/plugins/panel/pmm-update',
  ],
};
