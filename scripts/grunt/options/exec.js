module.exports = function (config, grunt) {
  'use strict';

  return {
    tslint: {
      command: 'node ./node_modules/tslint/lib/tslintCli.js -c tslint.json --project ./tsconfig.json',
      src: ['public/app/**/*.ts*'],
    },
    tsc: {
      command: 'yarn tsc --noEmit',
      src: ['public/app/**/*.ts*'],
    },
    jest: 'node ./node_modules/jest-cli/bin/jest.js --maxWorkers 2',
    webpack: 'node ./node_modules/webpack/bin/webpack.js --config scripts/webpack/webpack.prod.js',
  };
};
