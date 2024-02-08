import { config } from '@grafana/runtime';

import { resolveModulePath } from './utils';

describe('resolveModulePath', () => {
  it.each`
    value                                                             | expected
    ${'http://localhost:3000/public/plugins/my-app-plugin/module.js'} | ${'http://localhost:3000/public/plugins/my-app-plugin/module.js'}
    ${'/public/plugins/my-app-plugin/module.js'}                      | ${'/public/plugins/my-app-plugin/module.js'}
    ${'public/plugins/my-app-plugin/module.js'}                       | ${'/public/plugins/my-app-plugin/module.js'}
  `(
    "Url correct formatting, when calling the rule with correct formatted value: '$value' then result should be '$expected'",
    ({ value, expected }) => {
      expect(resolveModulePath(value)).toBe(expected);
    }
  );

  it.each`
    value                                                             | expected
    ${'http://localhost:3000/public/plugins/my-app-plugin/module.js'} | ${'http://localhost:3000/public/plugins/my-app-plugin/module.js'}
    ${'/public/plugins/my-app-plugin/module.js'}                      | ${'/public/plugins/my-app-plugin/module.js'}
    ${'public/plugins/my-app-plugin/module.js'}                       | ${'/grafana/public/plugins/my-app-plugin/module.js'}
  `(
    "Url correct formatting, when calling the rule with correct formatted value: '$value' then result should be '$expected'",
    ({ value, expected }) => {
      config.appSubUrl = '/grafana';

      expect(resolveModulePath(value)).toBe(expected);
    }
  );
});
