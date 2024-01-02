import { DataFrame, Field, getFieldDisplayName } from '@grafana/data';

export const getTooltipFieldDisplayName = (field: Field, data: DataFrame[]) => {
  const dataFrameFieldIndex = field.state?.origin;
  return dataFrameFieldIndex
    ? getFieldDisplayName(
        data[dataFrameFieldIndex.frameIndex].fields[dataFrameFieldIndex.fieldIndex],
        data[dataFrameFieldIndex.frameIndex],
        data
      )
    : null;
};
