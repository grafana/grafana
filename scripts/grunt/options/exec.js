module.exports = function(config, grunt) {
  'use strict'
  return {
    tslint : "node ./node_modules/tslint/lib/tslint-cli.js -c tslint.json --project ./tsconfig.json",
    jest : "node ./node_modules/jest-cli/bin/jest.js",
  };
};
