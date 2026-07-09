import { PluginExtensionPoints } from '@grafana/data';

import { GRAFANA_CORE_PLUGIN_ID } from './constants';
import { registerCoreAddedComponent } from './coreExtensions';
import { AddedComponentsRegistry } from './registry/AddedComponentsRegistry';
import { AddedFunctionsRegistry } from './registry/AddedFunctionsRegistry';
import { AddedLinksRegistry } from './registry/AddedLinksRegistry';
import { ExposedComponentsRegistry } from './registry/ExposedComponentsRegistry';
import { getPluginExtensionRegistries } from './registry/setup';

jest.mock('./registry/setup', () => ({
  getPluginExtensionRegistries: jest.fn(),
}));

describe('registerCoreAddedComponent', () => {
  it('registers the component under the core plugin ID', async () => {
    const addedComponentsRegistry = new AddedComponentsRegistry([]);
    jest.mocked(getPluginExtensionRegistries).mockResolvedValue({
      addedComponentsRegistry,
      addedLinksRegistry: new AddedLinksRegistry([]),
      addedFunctionsRegistry: new AddedFunctionsRegistry([]),
      exposedComponentsRegistry: new ExposedComponentsRegistry([]),
    });

    await registerCoreAddedComponent({
      targets: [PluginExtensionPoints.AlertingRuleAnnotationsAssistant],
      title: 'Test component',
      description: 'A component registered by core Grafana',
      component: () => <div>test</div>,
    });

    const state = await addedComponentsRegistry.getState();
    const registered = state[PluginExtensionPoints.AlertingRuleAnnotationsAssistant];

    expect(registered).toHaveLength(1);
    expect(registered[0].pluginId).toBe(GRAFANA_CORE_PLUGIN_ID);
    expect(registered[0].title).toBe('Test component');
  });
});
