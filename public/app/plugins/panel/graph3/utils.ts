import { DataFrame, FieldType, getTimeField, sortDataFrame, transformDataFrame } from '@grafana/data';

// very time oriented for now
export const alignAndSortDataFramesByFieldName = (data: DataFrame[], fieldName: string) => {
  // normalize time field names
  // in each frame find first time field and rename it to unified name
  for (let i = 0; i < data.length; i++) {
    const series = data[i];
    for (let j = 0; j < series.fields.length; j++) {
      const field = series.fields[j];
      if (field.type === FieldType.time) {
        field.name = fieldName;
        break;
      }
    }
  }

  const dataFramesToPlot = data.filter(frame => {
    let { timeIndex } = getTimeField(frame);
    // filter out series without time index or if the time column is the only one (i.e. after transformations)
    // won't live long as we gona move out from assuming x === time
    return timeIndex !== undefined ? frame.fields.length > 1 : false;
  });

  // uPlot data needs to be aligned on x-axis (ref. https://github.com/leeoniya/uPlot/issues/108)
  // For experimentation just assuming alignment on time field, needs to change
  const aligned = transformDataFrame(
    [
      {
        id: 'seriesToColumns',
        options: { byField: fieldName },
      },
    ],
    dataFramesToPlot
  )[0];

  // need to be more "clever", not time only in the future!
  return sortDataFrame(aligned, getTimeField(aligned).timeIndex!);
};
