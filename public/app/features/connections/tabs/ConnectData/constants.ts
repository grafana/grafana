import { PluginType, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';

export const FILTER_BY_OPTIONS = (translator: typeof t): SelectableValue[] => [
  { value: 'all', label: translator('connections.add-new-connection.filter-by-options.label.all', 'All') },
  { value: 'installed', label: translator('connections.add-new-connection.filter-by-options.label.installed', 'Installed') },
  {
    value: 'has-update',
    label: translator('connections.add-new-connection.filter-by-options.label.new-updates', 'New Updates'),
  },
];

export const GROUP_BY_OPTIONS = (translator: typeof t): SelectableValue[] => [
  { value: 'type', label: translator('connections.add-new-connection.group-by-options.label.type', 'Type') },
  { value: 'category', label: translator('connections.add-new-connection.group-by-options.label.category', 'Category') },
];

export const TYPE_FILTER_OPTIONS = (translator: typeof t): SelectableValue[] => [
  { value: 'all', label: translator('connections.add-new-connection.filter-by-options.label.all', 'All') },
  { value: PluginType.datasource, label: translator('connections.connect-data.datasources-header', 'Data Sources') },
  { value: PluginType.app, label: translator('connections.connect-data.apps-header', 'Apps') },
];

export const SORT_OPTIONS = (translator: typeof t): Array<{ value: string; label: string }> => [
  { value: 'nameAsc', label: translator('connections.add-new-connection.label.by-name-az', 'By name (A-Z)') },
  { value: 'nameDesc', label: translator('connections.add-new-connection.label.by-name-za', 'By name (Z-A)') },
  { value: 'updated', label: translator('connections.add-new-connection.label.by-updated-date', 'By updated date') },
  { value: 'published', label: translator('connections.add-new-connection.label.by-published-date', 'By published date') },
  { value: 'downloads', label: translator('connections.add-new-connection.label.by-downloads', 'By downloads') },
];
