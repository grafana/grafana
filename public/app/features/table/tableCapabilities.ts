import { type DataFrame } from '@grafana/data';
import { supportsColumnManagement } from '@grafana/ui/internal';

/** Enables the refreshed table capabilities on every field without mutating the frame. */
export function withRefreshedTableCapabilities(
  frame: DataFrame,
  columnManagementEnabled = supportsColumnManagement(frame)
): DataFrame {
  return {
    ...frame,
    fields: frame.fields.map((field) => ({
      ...field,
      config: {
        ...field.config,
        custom: {
          ...field.config.custom,
          filterable: true,
          reorderable: columnManagementEnabled,
          hideable: columnManagementEnabled,
        },
      },
    })),
  };
}
