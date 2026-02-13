import { DataFrame, FieldType, getFieldDisplayName, LogsSortOrder } from '@grafana/data';
import { TableSortByFieldState } from '@grafana/schema/dist/esm/common/common.gen';
import { LOGS_DATAPLANE_TIMESTAMP_NAME } from 'app/features/logs/logsFrame';

export function getDefaultSortBy(
  dataFrame: DataFrame | undefined,
  logsSortOrder: LogsSortOrder
): TableSortByFieldState[] {
  const field = dataFrame?.fields.find((field) => field.type === FieldType.time);
  const timeFieldName = field ? getFieldDisplayName(field) : LOGS_DATAPLANE_TIMESTAMP_NAME;
  return [
    {
      displayName: timeFieldName,
      desc: logsSortOrder === LogsSortOrder.Descending,
    },
  ];
}
