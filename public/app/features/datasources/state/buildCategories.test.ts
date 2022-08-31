import { DataSourcePluginMeta } from '@grafana/data';
import { getMockPlugin } from 'app/features/plugins/__mocks__/pluginMocks';

import { buildCategories } from './buildCategories';

const plugins: DataSourcePluginMeta[] = [
  {
    ...getMockPlugin({ id: 'graphite' }),
    category: 'tsdb',
  },
  {
    ...getMockPlugin({ id: 'prometheus' }),
    category: 'tsdb',
  },
  {
    ...getMockPlugin({ id: 'elasticsearch' }),
    category: 'logging',
  },
  {
    ...getMockPlugin({ id: 'loki' }),
    category: 'logging',
  },
  {
    ...getMockPlugin({ id: 'azure' }),
    category: 'cloud',
  },
];

describe('buildCategories', () => {
  const categories = buildCategories(plugins);

  it('should group plugins into categories and remove empty categories', () => {
    expect(categories.length).toBe(4);
    expect(categories[0].title).toBe('Time series databases');
    expect(categories[0].plugins.length).toBe(2);
    expect(categories[1].title).toBe('Logging & document databases');
  });

  it('should sort plugins according to hard coded sorting rules', () => {
    expect(categories[1].plugins[0].id).toBe('loki');
  });

  it('should add phantom plugin for Grafana cloud', () => {
    expect(categories[2].title).toBe('Cloud');
    expect(categories[2].plugins.length).toBe(2);
    expect(categories[2].plugins[1].id).toBe('gcloud');
  });

  it('should set module to phantom on phantom plugins', () => {
    expect(categories[3].plugins[0].module).toBe('phantom');
  });

  it('should add enterprise phantom plugins', () => {
    const enterprisePluginsCategory = categories[3];
    expect(enterprisePluginsCategory.title).toBe('Enterprise plugins');
    expect(enterprisePluginsCategory.plugins.length).toBe(17);
    expect(enterprisePluginsCategory.plugins[0].name).toBe('AppDynamics');
    expect(enterprisePluginsCategory.plugins[enterprisePluginsCategory.plugins.length - 1].name).toBe('Wavefront');
  });
});
