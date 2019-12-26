import { DataSourcePluginMeta, PluginType } from '@grafana/data';
import { DataSourcePluginCategory } from 'app/types';

export function buildCategories(plugins: DataSourcePluginMeta[]): DataSourcePluginCategory[] {
  const categories: DataSourcePluginCategory[] = [
    { id: 'tsdb', title: 'Time series databases', plugins: [] },
    { id: 'logging', title: 'Logging & document databases', plugins: [] },
    { id: 'sql', title: 'SQL', plugins: [] },
    { id: 'cloud', title: 'Cloud', plugins: [] },
    { id: 'other', title: 'Others', plugins: [] },
    { id: 'enterprise', title: 'Enterprise', plugins: [] },
  ];

  const other = categories.find(item => item.id === 'other');

  for (const plugin of plugins) {
    const category = categories.find(item => item.id === plugin.category) || other;
    category.plugins.push(plugin);
  }

  for (const category of categories) {
    // add phantom plugin
    if (category.id === 'cloud') {
      category.plugins.push(getGrafanaCloudPhantomPlugin());
    }

    sortPlugins(category.plugins);
  }

  return categories;
}

function sortPlugins(plugins: DataSourcePluginMeta[]) {
  const sortingRules: { [id: string]: number } = {
    prometheus: 100,
    graphite: 95,
    loki: 90,
    mysql: 80,
    postgres: 79,
    gcloud: -1,
  };

  plugins.sort((a, b) => {
    const aSort = sortingRules[a.id] || 0;
    const bSort = sortingRules[b.id] || 0;
    if (aSort > bSort) {
      return -1;
    }
    if (aSort < bSort) {
      return 1;
    }

    return a.name > b.name ? -1 : 1;
  });
}

function getGrafanaCloudPhantomPlugin(): DataSourcePluginMeta {
  return {
    id: 'gcloud',
    name: 'Grafana Cloud',
    type: PluginType.datasource,
    module: '',
    baseUrl: '',
    info: {
      description: 'Hosted Graphite, Prometheus and Loki',
      logos: { small: 'public/img/grafana_icon.svg', large: 'asd' },
      author: { name: 'Grafana Labs' },
      links: [
        {
          url: 'https://grafana.com/products/cloud/',
          name: 'Learn more',
        },
      ],
      screenshots: [],
      updated: '2019-05-10',
      version: '1.0.0',
    },
  };
}
