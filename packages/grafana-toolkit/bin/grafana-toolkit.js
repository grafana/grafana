#!/usr/bin/env node

var path = require('path') ;

// This bin is used for cli executed internally

var tsProjectPath = path.resolve(__dirname, '../tsconfig.json');

require('ts-node').register({
  project: tsProjectPath
});

require('../src/cli/index.ts').run(true);
