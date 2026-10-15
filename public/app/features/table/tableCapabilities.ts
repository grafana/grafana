import { FieldType, type DataFrame } from '@grafana/data';

export function supportsColumnManagement(frame: DataFrame | undefined): boolean {
  return Boolean(frame && !frame.fields.some((field) => field.type === FieldType.nestedFrames));
}

/** Sets field capabilities for ad hoc transformations without mutating the frame. */
export function withAdHocTransformCapabilities(
  frame: DataFrame,
  columnManagementEnabled = supportsColumnManagement(frame),
  filteringEnabled = true
): DataFrame {
  return {
    ...frame,
    fields: frame.fields.map((field) => ({
      ...field,
      config: {
        ...field.config,
        custom: {
          ...field.config.custom,
          filterable: filteringEnabled,
          hideable: columnManagementEnabled && (field.config.custom?.hideable ?? true),
        },
      },
    })),
  };
}
