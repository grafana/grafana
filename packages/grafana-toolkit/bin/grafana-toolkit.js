#!/usr/bin/env node
require('ts-node').register({
  project: `${process.cwd()}/node_modules/@grafana/toolkit/tsconfig.json`
});
require('../src/cli/index.ts').run();
