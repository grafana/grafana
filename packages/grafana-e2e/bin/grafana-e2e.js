#!/usr/bin/env node

// This file is used only for internal executions

require('ts-node').register({
  project: `${__dirname}/../tsconfig.json`,
  transpileOnly: true,
});

require('../src/cli/index.ts').default();
