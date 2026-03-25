import { DataFrame, Field, FieldType, getRawDisplayProcessor, LogsModel } from "@grafana/data";
import { logSeriesToLogsModel } from "app/features/logs/logsModel";

export function rawDataFrameToLogsFrame(dataFrame: DataFrame) {
  const logsModel = logSeriesToLogsModel([dataFrame], undefined, false);
  if (!logsModel) {
    return dataFrame;
  }
  return addLogLevelField(dataFrame, logsModel);
}

// Easily overridable name if needed, otherwise generated.
export const LOG_LEVEL_FIELD_NAME = 'log_level';

function addLogLevelField(dataFrame: DataFrame, logsModel: LogsModel): DataFrame {
  if (dataFrame.fields.find(field => field.name === LOG_LEVEL_FIELD_NAME)) {
    return dataFrame;
  }
  const logLevelValues = dataFrame.fields[0].values.map((_: unknown, index: number) => logsModel.rows.find(logRowModel => logRowModel.dataFrame.refId === dataFrame.refId && logRowModel.rowIndex === index)?.logLevel ?? undefined);
  const logLevelField: Field = {
    name: LOG_LEVEL_FIELD_NAME,
    display: getRawDisplayProcessor(),
    type: FieldType.string,
    config: {},
    values: logLevelValues
  };
  return {
    ...dataFrame,
    fields: [
      ...dataFrame.fields,
      logLevelField,
    ]
  };
}
