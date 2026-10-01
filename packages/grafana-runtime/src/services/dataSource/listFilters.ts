import { type DataSourceInstanceListItem, matchPluginId } from '@grafana/data';

import { type GetDataSourceListFilters } from '../dataSourceSrv';
import { getTemplateSrv } from '../templateSrv';

import { getDefaultListItem, getListItemByName, getListItemByUid, getNamedListItems } from './cache';

/**
 * Filters for {@link getDataSourceInstanceList} and {@link useDataSourceInstanceList}.
 *
 * Identical to {@link GetDataSourceListFilters} except the `filter` callback receives a
 * {@link DataSourceInstanceListItem} instead of the full {@link DataSourceInstanceSettings}.
 * This reflects the long-term data model: the list API will only expose the slim item shape,
 * so filter callbacks must not rely on settings-specific fields such as `jsonData` or `url`.
 *
 * @public
 */
export interface GetDataSourceInstanceListFilters extends Omit<GetDataSourceListFilters, 'filter'> {
  /** Apply a function to filter the list. Receives a slim {@link DataSourceInstanceListItem}. */
  filter?: (item: DataSourceInstanceListItem) => boolean;
}

/**
 * Filter the list layer with the same semantics as the legacy `DataSourceSrv.getList()`.
 *
 * The `filter` callback is checked on base items and on -- Grafana --, but NOT on -- Mixed -- or
 * -- Dashboard --, which are appended unconditionally.
 */
export function applyFilters(filters: GetDataSourceInstanceListFilters = {}): DataSourceInstanceListItem[] {
  const base = getNamedListItems().filter((x) => {
    if (x.meta.id === 'grafana' || x.meta.id === 'mixed' || x.meta.id === 'dashboard') {
      return false;
    }
    if (filters.metrics && !x.meta.metrics) {
      return false;
    }
    if (filters.tracing && !x.meta.tracing) {
      return false;
    }
    if (filters.logs && x.meta.category !== 'logging' && !x.meta.logs) {
      return false;
    }
    if (filters.annotations && !x.meta.annotations) {
      return false;
    }
    if (filters.alerting && !x.meta.alerting) {
      return false;
    }
    if (filters.pluginId && !matchPluginId(filters.pluginId, x.meta)) {
      return false;
    }
    if (filters.filter && !filters.filter(x)) {
      return false;
    }
    if (filters.type) {
      if (Array.isArray(filters.type)) {
        if (!filters.type.includes(x.type)) {
          return false;
        }
      } else if (!(x.type === filters.type || x.meta.aliasIDs?.includes(filters.type))) {
        return false;
      }
    }
    if (
      !filters.all &&
      x.meta.metrics !== true &&
      x.meta.annotations !== true &&
      x.meta.tracing !== true &&
      x.meta.logs !== true &&
      x.meta.alerting !== true
    ) {
      return false;
    }
    return true;
  });

  if (filters.variables) {
    for (const variable of getTemplateSrv().getVariables()) {
      if (variable.type !== 'datasource') {
        continue;
      }
      let item: DataSourceInstanceListItem | undefined;
      if (variable.current.value === 'default') {
        item = getDefaultListItem();
      } else {
        const value = variable.current.value;
        const dsValue = Array.isArray(value) ? value[0] : value;
        item = typeof dsValue === 'string' ? (getListItemByName(dsValue) ?? getListItemByUid(dsValue)) : undefined;
      }
      if (item) {
        const key = `\${${variable.name}}`;
        base.push({
          ...item,
          isDefault: false,
          name: key,
          uid: key,
        });
      }
    }
  }

  const results = base.sort((a, b) => {
    if (a.name.toLowerCase() > b.name.toLowerCase()) {
      return 1;
    }
    if (a.name.toLowerCase() < b.name.toLowerCase()) {
      return -1;
    }
    return 0;
  });

  if (!filters.pluginId && !filters.alerting) {
    if (filters.mixed) {
      const mixed = getBuiltIn('-- Mixed --');
      if (mixed) {
        results.push(mixed);
      }
    }
    if (filters.dashboard) {
      const dashboard = getBuiltIn('-- Dashboard --');
      if (dashboard) {
        results.push(dashboard);
      }
    }
    if (!filters.tracing) {
      const grafana = getBuiltIn('-- Grafana --');
      if (grafana && filters.filter?.(grafana) !== false) {
        results.push(grafana);
      }
    }
  }

  return results;
}

/** The default-flagged instance of a type, else the first match (legacy `findByType`). */
export function findByType(type: string): DataSourceInstanceListItem | undefined {
  const matches = applyFilters({ type });
  if (!matches.length) {
    return undefined;
  }
  return matches.find((item) => item.isDefault) ?? matches[0];
}

function getBuiltIn(name: string): DataSourceInstanceListItem | undefined {
  return getListItemByName(name) ?? getListItemByUid(name);
}
