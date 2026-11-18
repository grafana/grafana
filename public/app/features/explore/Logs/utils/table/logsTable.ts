import {
  type DataFrame,
  DataFrameType,
  type Field,
  FieldType,
  getFieldDisplayName,
  LogsSortOrder,
} from '@grafana/data';
import { type TableSortByFieldState } from '@grafana/schema/dist/esm/common/common.gen';
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
  dataFrame: DataFrame | undefined,
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

  return getDefaultSortBy(dataFrame, logsSortOrder);
};

type ActiveFieldMeta = {
  active: false;
  index: undefined; // if undefined the column is not selected
};

type InactiveFieldMeta = {
  active: true;
  index: number; // if undefined the column is not selected
};

type GenericMeta = {
  percentOfLinesWithLabel: number;
  type?: 'BODY_FIELD' | 'TIME_FIELD';
};

export type FieldNameMeta = (InactiveFieldMeta | ActiveFieldMeta) & GenericMeta;

type FieldName = string;
export type FieldNameMetaStore = Record<FieldName, FieldNameMeta>;

// TODO: explore if `logsFrame.ts` can help us with getting the right fields
// TODO Why is typeInfo not defined on the Field interface?
export function getLogsExtractFields(dataFrame: DataFrame) {
  return dataFrame.fields
    .filter((field: Field & { typeInfo?: { frame: string } }) => {
      const isFieldLokiLabels =
        field.typeInfo?.frame === 'json.RawMessage' &&
        field.name === 'labels' &&
        dataFrame?.meta?.type !== DataFrameType.LogLines;
      const isFieldDataplaneLabels =
        field.name === 'labels' && field.type === FieldType.other && dataFrame?.meta?.type === DataFrameType.LogLines;
      return isFieldLokiLabels || isFieldDataplaneLabels;
    })
    .flatMap((field: Field) => {
      return [
        {
          id: 'extractFields',
          options: {
            format: 'json',
            keepTime: false,
            replace: false,
            source: field.name,
          },
        },
      ];
    });
}

export const getLogsTableHeight = () => {
  // Instead of making the height of the table based on the content (like in the table panel itself), let's try to use the vertical space that is available.
  // Since this table is in explore, we can expect the user to be running multiple queries that return disparate numbers of rows and labels in the same session
  // Also changing the height of the table between queries can be and cause content to jump, so we'll set a minimum height of 500px, and a max based on the innerHeight
  // Ideally the table container should always be able to fit in the users viewport without needing to scroll
  return Math.max(window.innerHeight - 500, 500);
};
