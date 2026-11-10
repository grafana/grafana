import { type DataSourceInstanceListItem } from '@grafana/data';
import { type GetDataSourceInstanceListFilters } from '@grafana/runtime/unstable';

import { getAlertingDataSourceSettings } from './bootDataSettings';
import {
  SUPPORTED_EXTERNAL_RULE_SOURCE_TYPES,
  type SupportedExternalRulesSourceType,
  isDataSourceAllowedAsRecordingRulesTarget,
  isDataSourceManagingAlerts,
  isSupportedExternalRulesSourceType,
} from './predicates';

export interface RulesSourceDataSource extends DataSourceInstanceListItem {
  type: SupportedExternalRulesSourceType;
  managesAlerts: boolean;
  /** The raw data source flag. Whether the type can store recording rules is a separate check. */
  allowedAsRecordingRuleTarget: boolean;
}

// `all` keeps the instances whose plugin declares no query capabilities, as config.datasources does.
export const RULES_SOURCE_LIST_FILTERS: GetDataSourceInstanceListFilters = Object.freeze({
  type: [...SUPPORTED_EXTERNAL_RULE_SOURCE_TYPES],
  all: true,
});

/**
 * Converts the items of a {@link RULES_SOURCE_LIST_FILTERS} list. Keeps the list order, and keeps the data
 * sources that do not manage alerts. Drops an item without known settings, because the flag defaults are
 * permissive.
 */
export function toRulesSourceDataSources(items: DataSourceInstanceListItem[]): RulesSourceDataSource[] {
  return items.flatMap(({ uid, type, name, meta }) => {
    // A type filter does not stop the list from appending the built-in `-- Grafana --` data source.
    if (!isSupportedExternalRulesSourceType(type)) {
      return [];
    }

    const settings = getAlertingDataSourceSettings({ uid, type, name, meta });
    if (!settings) {
      return [];
    }

    return [
      {
        uid,
        type,
        name,
        meta,
        managesAlerts: isDataSourceManagingAlerts(settings),
        allowedAsRecordingRuleTarget: isDataSourceAllowedAsRecordingRulesTarget(settings),
      },
    ];
  });
}
