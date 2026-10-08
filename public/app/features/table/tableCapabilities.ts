import { FieldType, type DataFrame } from '@grafana/data';

export function supportsColumnManagement(frame: DataFrame | undefined): boolean {
  return Boolean(frame && !frame.fields.some((field) => field.type === FieldType.nestedFrames));
}

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
          hideable: columnManagementEnabled,
        },
      },
    })),
  };
}
