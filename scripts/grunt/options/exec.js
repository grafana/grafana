module.exports = function(config, grunt) {
  'use strict';

  return {
    tslintPackages: {
      command: 'yarn workspaces run tslint',
      src: ['packages/**/*.ts*'],
    },
    tslintRoot: {
      command: 'yarn run tslint',
      src: ['public/app/**/*.ts*'],
    },
    typecheckPackages: {
      command: 'yarn workspaces run typecheck',
      src: ['packages/**/*.ts*'],
    },
    typecheckRoot: {
      command: 'yarn run typecheck',
      src: ['public/app/**/*.ts*'],
    },
    jest: 'node ./node_modules/jest-cli/bin/jest.js --maxWorkers 2',
    webpack:
      'node ./node_modules/webpack/bin/webpack.js --config scripts/webpack/webpack.prod.js',
  };
};
