import { reportInteraction } from '@grafana/runtime';
import { type TableFilterInteraction } from '@grafana/ui/internal';

export function reportTableColumnInteraction(action: 'visibility' | 'reorder') {
  reportInteraction('grafana_table_changed_columns', { action });
}

export function reportTableFilterInteraction(interaction: TableFilterInteraction) {
  reportInteraction('grafana_table_applied_filter', { ...interaction });
}
