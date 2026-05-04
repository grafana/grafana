import { useMemo } from 'react';

import { PluginType, type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';

import type { CatalogPlugin } from '../../../../plugins/admin/types';
import { ROUTES } from '../../../constants';
import type { CardGridItem } from '../CardGrid/CardGrid';

const CATEGORY_ORDER = ['tsdb', 'logging', 'tracing', 'profiling', 'sql', 'cloud', 'enterprise', 'iot', 'other'];
const collator = new Intl.Collator();

function getPredefinedCategoryLabels(): Record<string, string> {
  return {
    tsdb: t('datasources.build-categories.categories.title.time-series-databases', 'Time series databases'),
    logging: t(
      'datasources.build-categories.categories.title.logging-document-databases',
      'Logging & document databases'
    ),
    tracing: t('datasources.build-categories.categories.title.distributed-tracing', 'Distributed tracing'),
    profiling: t('datasources.build-categories.categories.title.profiling', 'Profiling'),
    sql: t('datasources.build-categories.categories.title.sql', 'SQL'),
    cloud: t('datasources.build-categories.categories.title.cloud', 'Cloud'),
    enterprise: t('datasources.build-categories.categories.title.enterprise-plugins', 'Enterprise plugins'),
    iot: t('datasources.build-categories.categories.title.industrial-io-t', 'Industrial & IoT'),
    other: t('datasources.build-categories.categories.title.others', 'Others'),
  };
}

export function useCategoryFilterOptions(plugins: CatalogPlugin[]): SelectableValue[] {
  const predefinedCategories = getPredefinedCategoryLabels();
  return useMemo(() => {
    const uniqueCategories = new Set<string>();
    plugins.forEach((p) => uniqueCategories.add(p.category || 'other'));

    const options: SelectableValue[] = [
      { value: 'all', label: t('connections.add-new-connection.filter-by-options.label.all', 'All') },
    ];

    CATEGORY_ORDER.forEach((cat) => {
      if (uniqueCategories.has(cat)) {
        options.push({ value: cat, label: predefinedCategories[cat] || cat });
      }
    });

    // Add custom categories alphabetically
    Array.from(uniqueCategories)
      .filter((cat) => !predefinedCategories[cat])
      .sort()
      .forEach((cat) => {
        options.push({ value: cat, label: cat });
      });

    return options;
  }, [plugins, predefinedCategories]);
}

function pluginToCardGridItem(plugin: CatalogPlugin): CardGridItem {
  return {
    ...plugin,
    logo: plugin.info.logos.small,
    url:
      plugin.type === PluginType.datasource
        ? ROUTES.DataSourcesDetails.replace(':id', plugin.id)
        : `/plugins/${plugin.id}`,
  };
}

/**
 * Single hook that splits plugins by type, applies category/type filters,
 * and returns card grid items for both views.
 */
export function useFilteredPlugins(
  plugins: CatalogPlugin[],
  groupBy: string,
  categoryFilter: string,
  typeFilter: string
) {
  return useMemo(() => {
    const dataSources = plugins.filter((p) => p.type === PluginType.datasource);
    const apps = plugins.filter((p) => p.type === PluginType.app);

    // For "group by type" view: apply category filter
    const filteredDataSources =
      categoryFilter === 'all' ? dataSources : dataSources.filter((p) => (p.category || 'other') === categoryFilter);
    const filteredApps =
      categoryFilter === 'all' ? apps : apps.filter((p) => (p.category || 'other') === categoryFilter);

    // For "group by type" view: also apply type filter (hide entire section)
    const typeFilteredDataSources = typeFilter === 'all' || typeFilter === PluginType.datasource ? dataSources : [];
    const typeFilteredApps = typeFilter === 'all' || typeFilter === PluginType.app ? apps : [];

    // Build card grid items based on groupBy mode
    const datasourceCardGridItems = (groupBy === 'type' ? filteredDataSources : typeFilteredDataSources).map(
      pluginToCardGridItem
    );
    const appsCardGridItems = (groupBy === 'type' ? filteredApps : typeFilteredApps).map(pluginToCardGridItem);

    return {
      datasourceCardGridItems,
      appsCardGridItems,
    };
  }, [plugins, groupBy, categoryFilter, typeFilter]);
}

/**
 * Groups plugins by category for the "group by category" view,
 * applying typeFilter and returning sorted { label, items } entries.
 */
export function usePluginsByCategory(
  plugins: CatalogPlugin[],
  typeFilter: string
): Array<{ label: string; items: CardGridItem[] }> {
  const categoryLabels = getPredefinedCategoryLabels();
  return useMemo(() => {
    const allPlugins = typeFilter === 'all' ? plugins : plugins.filter((p) => p.type === typeFilter);

    const grouped: Record<string, CardGridItem[]> = {};
    allPlugins.forEach((plugin) => {
      const category = plugin.category || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(pluginToCardGridItem(plugin));
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => {
        const aIndex = CATEGORY_ORDER.indexOf(a);
        const bIndex = CATEGORY_ORDER.indexOf(b);
        if (aIndex === -1 && bIndex === -1) {
          return collator.compare(a, b);
        }
        if (aIndex === -1) {
          return 1;
        }
        if (bIndex === -1) {
          return -1;
        }
        return aIndex - bIndex;
      })
      .map(([category, items]) => ({
        label: categoryLabels[category] || category,
        items,
      }));
  }, [plugins, typeFilter, categoryLabels]);
}
