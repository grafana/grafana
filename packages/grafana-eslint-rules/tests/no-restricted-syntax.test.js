import { RuleTester } from 'eslint';

import noRestrictedSyntax from '../rules/no-restricted-syntax.cjs';

RuleTester.setDefaultConfig({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    parser: require('@typescript-eslint/parser'),
  },
});

const ruleTester = new RuleTester();

const rule = noRestrictedSyntax.rules['no-direct-create-monitoring-logger'];

const expectedMessage =
  'Direct usage of createMonitoringLogger is not allowed. Register your logger source in packages/grafana-runtime/src/services/logging/loggers.ts and use getLogger from @grafana/runtime/unstable instead.';

ruleTester.run('no-direct-create-monitoring-logger', rule, {
  valid: [
    {
      name: 'getLogger from @grafana/runtime/unstable',
      code: `import { getLogger } from '@grafana/runtime/unstable';`,
    },
    {
      name: 'other named imports from @grafana/runtime',
      code: `import { config, type MonitoringLogger } from '@grafana/runtime';`,
    },
    {
      name: 'createMonitoringLogger imported from a relative path (registry use)',
      code: `import { createMonitoringLogger } from '../../utils/logging';`,
    },
  ],
  invalid: [
    {
      name: 'createMonitoringLogger imported from @grafana/runtime',
      code: `import { createMonitoringLogger } from '@grafana/runtime';`,
      errors: [{ message: expectedMessage }],
    },
    {
      name: 'aliased createMonitoringLogger import from @grafana/runtime',
      code: `import { createMonitoringLogger as cml } from '@grafana/runtime';`,
      errors: [{ message: expectedMessage }],
    },
    {
      name: 'createMonitoringLogger alongside other imports — only one error',
      code: `import { config, createMonitoringLogger, type MonitoringLogger } from '@grafana/runtime';`,
      errors: [{ message: expectedMessage }],
    },
    {
      name: 'runtime import from @grafana/runtime',
      code: `import runtime from '@grafana/runtime'; const logger = runtime.createMonitoringLogger('my-logger');`,
      errors: [{ message: expectedMessage }],
    },
    {
      name: 'runtime star import from @grafana/runtime',
      code: `import * as runtime from '@grafana/runtime'; const logger = runtime.createMonitoringLogger('my-logger');`,
      errors: [{ message: expectedMessage }],
    },
  ],
});
