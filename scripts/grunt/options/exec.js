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
    jest: 'yarn run jest-ci',
    webpack:
      'node ./node_modules/webpack/bin/webpack.js --config scripts/webpack/webpack.prod.js',
  };
};
