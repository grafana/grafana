import { buildCategories } from './buildCategories';
import { getMockPlugin } from '../../plugins/__mocks__/pluginMocks';
import { DataSourcePluginMeta } from '@grafana/data';

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

  it('should group plugins into categories', () => {
    expect(categories.length).toBe(6);
    expect(categories[0].title).toBe('Time series databases');
    expect(categories[0].plugins.length).toBe(2);
    expect(categories[1].title).toBe('Logging & document databases');
  });

  it('should sort plugins according to hard coded sorting rules', () => {
    expect(categories[1].plugins[0].id).toBe('loki');
  });

  it('should add phantom plugin for Grafana cloud', () => {
    expect(categories[3].title).toBe('Cloud');
    expect(categories[3].plugins.length).toBe(2);
    expect(categories[3].plugins[1].id).toBe('gcloud');
  });

  it('should set module to phantom on phantom plugins', () => {
    expect(categories[4].plugins[0].module).toBe('phantom');
  });

  it('should add enterprise phantom plugins', () => {
    expect(categories[4].title).toBe('Enterprise plugins');
    expect(categories[4].plugins.length).toBe(6);
  });
});
