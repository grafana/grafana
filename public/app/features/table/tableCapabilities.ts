import { type DataFrame, FieldType } from '@grafana/data';

/** Column management is deferred for nested tables until parent and child field behavior is defined. */
export function supportsColumnManagement(frame: DataFrame | undefined): boolean {
  return Boolean(frame && !frame.fields.some((field) => field.type === FieldType.nestedFrames));
}

/** Enables the refreshed table capabilities on every field without mutating the frame. */
export function withRefreshedTableCapabilities(frame: DataFrame): DataFrame {
  const columnManagementEnabled = supportsColumnManagement(frame);

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
