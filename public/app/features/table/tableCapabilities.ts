import { type DataFrame } from '@grafana/data';

/**
 * The frame with every column marked filterable, reorderable and hideable.
 *
 * TableNG reads what a column lets the user do from that column's own field config, so a caller opts
 * in per column. The table panel opts every column in at once under `table.refreshNewFeatures`:
 * these stopped being things a panel author configures per field, and the field options went with
 * them. Every other TableNG caller — the inspector's raw-frame preview, the logs table, the flame
 * graph — leaves the config as it is and keeps opting in per column.
 *
 * Applied here rather than saved into field config, so nothing about it reaches the dashboard. The
 * `values` array is passed through by reference: only `config.custom` is copied.
 */
export function withRefreshedTableCapabilities(frame: DataFrame): DataFrame {
  return {
    ...frame,
    fields: frame.fields.map((field) => ({
      ...field,
      config: {
        ...field.config,
        custom: { ...field.config.custom, filterable: true, reorderable: true, hideable: true },
      },
    })),
  };
}
