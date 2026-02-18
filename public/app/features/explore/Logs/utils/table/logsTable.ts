import { DataFrame, FieldType, getFieldDisplayName, LogsSortOrder } from '@grafana/data';
import { TableSortByFieldState } from '@grafana/schema/dist/esm/common/common.gen';
import { LOGS_DATAPLANE_TIMESTAMP_NAME } from 'app/features/logs/logsFrame';

function getDefaultSortBy(dataFrame: DataFrame | undefined, logsSortOrder: LogsSortOrder): TableSortByFieldState[] {
  const field = dataFrame?.fields.find((field) => field.type === FieldType.time);
  const timeFieldName = field ? getFieldDisplayName(field) : LOGS_DATAPLANE_TIMESTAMP_NAME;
  return [
    {
      displayName: timeFieldName,
      desc: logsSortOrder === LogsSortOrder.Descending,
    },
  ];
}

export const getDefaultTableSortBy = (
  tableSortByDefaultStringFromStorage: string,
  logsFrames: DataFrame[] | undefined,
  tableFrameIndex: number,
  logsSortOrder: LogsSortOrder
): TableSortByFieldState[] => {
  if (tableSortByDefaultStringFromStorage) {
    try {
      const parsed: unknown = JSON.parse(tableSortByDefaultStringFromStorage);
      if (
        Array.isArray(parsed) &&
        parsed.every(
          (tableSort) =>
            'desc' in tableSort &&
            'displayName' in tableSort &&
            typeof tableSort.displayName === 'string' &&
            typeof tableSort.desc === 'boolean'
        )
      ) {
        return parsed;
      }
    } catch (e) {
      console.error('failed to parse table sort from local storage!', e);
    }
  }

  return getDefaultSortBy(logsFrames?.[tableFrameIndex], logsSortOrder);
};
