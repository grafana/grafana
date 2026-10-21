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

function getPluginCategory(plugin: CatalogPlugin): string {
  return plugin.isEnterprise ? 'enterprise' : plugin.category || 'other';
}

function matchesFilter(selected: string[], value: string | undefined): boolean {
  return selected.length === 0 || (value !== undefined && selected.includes(value));
}

export function useCategoryFilterOptions(plugins: CatalogPlugin[]): SelectableValue[] {
  const predefinedCategories = getPredefinedCategoryLabels();
  return useMemo(() => {
    const uniqueCategories = new Set<string>();
    plugins.forEach((p) => uniqueCategories.add(getPluginCategory(p)));

    const options: SelectableValue[] = [];

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

export function useFilteredPlugins(plugins: CatalogPlugin[], categoryFilter: string[], typeFilter: string[]) {
  return useMemo(() => {
    const catFiltered = plugins.filter((p) => matchesFilter(categoryFilter, getPluginCategory(p)));

    const typeFilteredDataSources = matchesFilter(typeFilter, PluginType.datasource)
      ? catFiltered.filter((p) => p.type === PluginType.datasource)
      : [];
    const typeFilteredApps = matchesFilter(typeFilter, PluginType.app)
      ? catFiltered.filter((p) => p.type === PluginType.app)
      : [];

    const datasourceCardGridItems = typeFilteredDataSources.map(pluginToCardGridItem);
    const appsCardGridItems = typeFilteredApps.map(pluginToCardGridItem);

    return {
      datasourceCardGridItems,
      appsCardGridItems,
    };
  }, [plugins, categoryFilter, typeFilter]);
}

export function usePluginsByCategory(
  plugins: CatalogPlugin[],
  typeFilter: string[],
  categoryFilter: string[]
): Array<{ label: string; items: CardGridItem[] }> {
  const categoryLabels = getPredefinedCategoryLabels();
  return useMemo(() => {
    const allPlugins = plugins.filter(
      (p) => matchesFilter(typeFilter, p.type) && matchesFilter(categoryFilter, getPluginCategory(p))
    );

    const grouped: Record<string, CardGridItem[]> = {};
    allPlugins.forEach((plugin) => {
      const category = getPluginCategory(plugin);
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
  }, [plugins, typeFilter, categoryFilter, categoryLabels]);
}
