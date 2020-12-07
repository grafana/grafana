import { FieldConfigSource, FieldMatcherID, getFieldDisplayName } from '@grafana/data';
import { GraphNGLegendEvent } from '@grafana/ui';

export const displayConfigFactory = (
  event: GraphNGLegendEvent,
  fieldConfig: FieldConfigSource<any>
): FieldConfigSource<any> => {
  const { field, frame, data } = event;
  const displayName = getFieldDisplayName(field, frame, data);

  return {
    ...fieldConfig,
    overrides: [
      ...fieldConfig.overrides,
      {
        matcher: {
          id: FieldMatcherID.byRegexp,
          options: `^(?!${displayName}$).*$`,
        },
        properties: [
          {
            id: 'custom.seriesConfig',
            value: {
              displayInGraph: false,
              displayInLegend: true,
              displayInTooltip: true,
            },
          },
        ],
      },
    ],
  };
};
