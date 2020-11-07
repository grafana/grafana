import { DataFrame, FieldType, getTimeField, outerJoinDataFrames, sortDataFrame } from '@grafana/data';

// very time oriented for now
export const alignAndSortDataFramesByFieldName = (data: DataFrame[], fieldName: string): DataFrame | null => {
  if (!data.length) {
    return null;
  }

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

  const aligned = outerJoinDataFrames(dataFramesToPlot, { byField: fieldName })[0];
  return sortDataFrame(aligned, getTimeField(aligned).timeIndex!);
};
