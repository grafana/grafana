import * as grafanaData from '@grafana/data';
import { QueryField, makeValue } from '@grafana/ui';

import { sandboxPluginDependencies } from '../sandbox/pluginDependencies';

import { SystemJS } from './systemjs';
// eslint-disable-next-line import/order
import { sharedDependenciesMap } from './sharedDependencies';
import { buildImportMap } from './utils';

describe('shared Grafana UI', () => {
  const pluginId = 'test:shared-ui-plugin';
  const dependencyId = 'package:@grafana/ui';

  beforeEach(() => {
    SystemJS.addImportMap({ imports: buildImportMap({ '@grafana/ui': sharedDependenciesMap['@grafana/ui'] }) });
  });

  afterEach(() => {
    SystemJS.delete(pluginId);
    SystemJS.delete(dependencyId);
    sandboxPluginDependencies.delete('@grafana/ui');
  });

  it('lets a plugin use Slate synchronously during execution and shares core component identities', async () => {
    let ui: { QueryField: typeof QueryField; makeValue: typeof makeValue };
    SystemJS.register(pluginId, ['@grafana/ui'], (_export) => ({
      setters: [(module) => (ui = module as typeof ui)],
      execute: () => {
        const value = ui.makeValue('first line\nsecond line', 'promql');
        _export({
          lines: value.document
            .getTexts()
            .map((text) => text.text)
            .toArray(),
          QueryField: ui.QueryField,
          makeValue: ui.makeValue,
        });
      },
    }));

    const [plugin, shared] = await Promise.all([SystemJS.import(pluginId), SystemJS.import('@grafana/ui')]);

    expect(plugin.lines).toEqual(['first line', 'second line']);
    expect(plugin.QueryField).toBe(QueryField);
    expect(plugin.makeValue).toBe(makeValue);
    expect(shared.PanelPlugin).toBe(grafanaData.PanelPlugin);
    expect(shared.DataSourcePlugin).toBe(grafanaData.DataSourcePlugin);
    expect(shared.AppPlugin).toBe(grafanaData.AppPlugin);
    expect(shared.DataSourceApi).toBe(grafanaData.DataSourceApi);
  });

  it('shares the same Slate implementation with sandbox dependency resolution', async () => {
    const dependency = sandboxPluginDependencies.get('@grafana/ui');
    if (!dependency) {
      throw new Error('Shared UI dependency is not registered');
    }
    const sandboxUI = typeof dependency === 'function' ? await dependency() : dependency;
    const systemUI = await SystemJS.import('@grafana/ui');

    expect(sandboxUI.makeFragment('query').getTexts().first().text).toBe('query');
    expect(sandboxUI.QueryField).toBe(systemUI.QueryField);
    expect(sandboxUI.makeValue).toBe(systemUI.makeValue);
    expect(sandboxUI.PanelPlugin).toBe(grafanaData.PanelPlugin);
  });
});
