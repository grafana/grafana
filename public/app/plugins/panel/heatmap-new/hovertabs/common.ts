import { ArrayVector, DataFrame, Field, SplitOpen, TimeRange, ValueLinkConfig } from '@grafana/data';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';

export const resolveMappingToData = (
  data: DataFrame,
  indicies: number[] | null,
  onSplitOpen?: SplitOpen | undefined,
  timeRange?: TimeRange
): DataFrame[] => {
  if (!indicies) {
    return [];
  }

  return indicies.map((index: number, i: number) => {
    return {
      name: `${i + 1}`,
      fields: data.fields.map((f: Field) => {
        const newField = {
          ...f,
          values: new ArrayVector([f.values.get(index)]),
          length: 1,
        };
        if (f.config.links?.length && timeRange) {
          // We have links to configure. Add a getLinks function to the field
          newField.getLinks = (config: ValueLinkConfig) => {
            return getFieldLinksForExplore({ field: f, rowIndex: i, splitOpenFn: onSplitOpen, range: timeRange });
          };
        }
        return newField;
      }),
      length: data.fields.length,
    };
  });
};
