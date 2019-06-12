#!/usr/bin/env node
// This bin is used for cli being used internally

require('ts-node').register({
  project: 'packages/grafana-toolkit/tsconfig.json'
});
require('../src/cli/index.ts').run();
