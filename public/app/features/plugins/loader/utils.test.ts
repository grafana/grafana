import { config } from '@grafana/runtime';

import { sandboxPluginDependencies } from '../sandbox/pluginDependencies';

import { SystemJS } from './systemjs';
import { buildImportMap, resolveModulePath } from './utils';

describe('buildImportMap', () => {
  const dependencyName = 'test-lazy-dependency';
  const moduleName = `package:${dependencyName}`;

  afterEach(() => {
    SystemJS.delete(moduleName);
    sandboxPluginDependencies.delete(dependencyName);
  });

  it('calls a lazy dependency factory only when SystemJS imports the dependency', async () => {
    const loadDependency = jest.fn(async () => ({ value: 'loaded' }));

    const imports = buildImportMap({ [dependencyName]: loadDependency });

    expect(imports).toEqual({ [dependencyName]: moduleName });
    expect(loadDependency).not.toHaveBeenCalled();

    const dependency = await SystemJS.import(moduleName);

    expect(dependency.value).toBe('loaded');
    expect(loadDependency).toHaveBeenCalledTimes(1);
  });
});

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
