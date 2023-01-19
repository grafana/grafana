import { PluginExtensions } from '@grafana/data';

import { configurePluginExtensions, getRegistry } from './registry';

describe('Plugin registry', () => {
  const bootRegistry: Record<string, PluginExtensions> = {
    'belugacdn-app': {
      links: [
        {
          id: 'declare-incident',
          description: 'Incidents are occurring!',
          path: '/incidents/declare',
        },
      ],
    },
  };

  beforeEach(() => {
    configurePluginExtensions(bootRegistry);
  });

  it('should do something', () => {
    const registry = getRegistry();

    expect(registry.links).toEqual({
      'belugacdn-app.declare-incident': {
        description: 'Incidents are occurring!',
        href: '/a/belugacdn-app/incidents/declare',
      },
    });
  });
});
