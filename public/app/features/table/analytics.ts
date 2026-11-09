import { reportInteraction } from '@grafana/runtime';

export function reportTableColumnInteraction(action: 'visibility' | 'reorder') {
  reportInteraction('grafana_table_changed_columns', { action });
}

export function reportTableFilterInteraction(interaction: {
  action: 'apply';
  filter_type: 'local' | 'transformation' | 'adhoc';
  filter_kind: 'values' | 'numeric_range' | 'date_range' | 'other';
}) {
  reportInteraction('grafana_table_changed_filter', interaction);
}
