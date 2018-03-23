module.exports = function(config, grunt) {
  'use strict';

  var coverage = '';
  if (config.coverage) {
    coverage = '--coverage --maxWorkers 2';
  }

  return {
    tslint: 'node ./node_modules/tslint/lib/tslint-cli.js -c tslint.json --project ./tsconfig.json',
    jest: 'node ./node_modules/jest-cli/bin/jest.js ' + coverage,
    webpack: 'node ./node_modules/webpack/bin/webpack.js --config scripts/webpack/webpack.prod.js',
  };
};
