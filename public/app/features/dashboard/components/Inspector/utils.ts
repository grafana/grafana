import { ArrayVector, DataFrame } from '@grafana/data';

export const filterDataFrameByRowIds = (dataFrame: DataFrame, rowIds: number[] | undefined) => {
  if (!rowIds) {
    return dataFrame;
  }

  return {
    ...dataFrame,
    fields: dataFrame.fields.map(({ values, ...rest }) => ({
      ...rest,
      values: new ArrayVector(values.toArray().filter((_: any, index: number) => rowIds.includes(index))),
    })),
  };
};
