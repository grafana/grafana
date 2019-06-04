#!/usr/bin/env node

require('ts-node').register({
  project: 'packages/grafana-toolkit/tsconfig.json'
});
require('../src/cli/index.ts').run();
