import { PluginType, type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';

export const FILTER_BY_OPTIONS = (): SelectableValue[] => [
  { value: 'all', label: t('connections.add-new-connection.filter-by-options.label.all', 'All') },
  {
    value: 'installed',
    label: t('connections.add-new-connection.filter-by-options.label.installed', 'Installed'),
  },
  {
    value: 'has-update',
    label: t('connections.add-new-connection.filter-by-options.label.new-updates', 'New Updates'),
  },
];

export const GROUP_BY_OPTIONS = (): SelectableValue[] => [
  { value: 'type', label: t('connections.add-new-connection.group-by-options.label.type', 'Type') },
  {
    value: 'category',
    label: t('connections.add-new-connection.group-by-options.label.category', 'Category'),
  },
];

export const TYPE_FILTER_OPTIONS = (): SelectableValue[] => [
  { value: 'all', label: t('connections.add-new-connection.filter-by-options.label.all', 'All') },
  { value: PluginType.datasource, label: t('connections.connect-data.datasources-header', 'Data Sources') },
  { value: PluginType.app, label: t('connections.connect-data.apps-header', 'Apps') },
];

export const SORT_OPTIONS = (): Array<{ value: string; label: string }> => [
  { value: 'nameAsc', label: t('connections.add-new-connection.label.by-name-az', 'By name (A-Z)') },
  { value: 'nameDesc', label: t('connections.add-new-connection.label.by-name-za', 'By name (Z-A)') },
  { value: 'updated', label: t('connections.add-new-connection.label.by-updated-date', 'By updated date') },
  {
    value: 'published',
    label: t('connections.add-new-connection.label.by-published-date', 'By published date'),
  },
  { value: 'downloads', label: t('connections.add-new-connection.label.by-downloads', 'By downloads') },
];
