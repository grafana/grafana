import { useAsync } from 'react-use';

import { SelectableValue } from '@grafana/data';

import { QueryWithDefaults } from '../defaults';
import { DB, TableFieldSchema } from '../types';

type Options = {
  db: DB;
  query: QueryWithDefaults;
  isOrderable?: boolean;
};

export function useColumns({ db, query, isOrderable = false }: Options) {
  const datasourceId = db.dsID();
  const { value: apiClient } = useAsync(async () => await db.init(datasourceId), []);

  const state = useAsync(async () => {
    // TODO - move to DB impl so this will work with other sql implementations
    if (!query.dataset || !query.table) {
      return;
    }

    // TODO - db.fieldsWithSchema
    const columns = await db.fields(query, isOrderable);
    const schema = await db.tableSchema(query);
    const colTypes = new Map<string, SelectableValue[]>();

    for (let i = 0; i < columns.length; i++) {
      const cInfo = schema.schema ? getColumnInfoFromSchema(columns[i], schema.schema) : null;
      if (cInfo?.type) {
        if (colTypes.has(cInfo?.type)) {
          colTypes.get(cInfo.type)?.push({
            value: columns[i],
            label: columns[i],
            icon: cInfo?.type ? mapColumnTypeToIcon(cInfo?.type) : undefined,
          });
        } else {
          colTypes.set(cInfo?.type, [
            {
              value: columns[i],
              label: columns[i],
              icon: cInfo?.type ? mapColumnTypeToIcon(cInfo?.type) : undefined,
            },
          ]);
        }
      }
    }

    let results: SelectableValue[] = [];
    for (let [_, v] of colTypes.entries()) {
      results = results.concat(v);
    }
    return results;
  }, [apiClient, query]);

  return state;
}

export function getColumnInfoFromSchema(
  column: string,
  schema: TableFieldSchema[]
): { type?: string; description?: string } | null {
  const c = column.split('.');

  for (let i = 0; i < c.length; i++) {
    const f = schema.find((f) => f.name === c[i]);

    if (f && c[i + 1] !== undefined) {
      return getColumnInfoFromSchema(column.substr(c[i].length + 1), f?.schema);
    } else if (f) {
      return { type: f.repeated ? `Repeated ${f.type}` : f.type, description: f.description };
    }
  }
  return null;
}

export function mapColumnTypeToIcon(type: string) {
  switch (type) {
    case 'TIME':
    case 'DATETIME':
    case 'TIMESTAMP':
      return 'clock-nine';
    case 'BOOLEAN':
      return 'toggle-off';
    case 'INTEGER':
    case 'FLOAT':
    case 'FLOAT64':
    case 'INT':
    case 'SMALLINT':
    case 'BIGINT':
    case 'TINYINT':
    case 'BYTEINT':
    case 'INT64':
    case 'INT64':
    case 'NUMERIC':
    case 'DECIMAL':
      return 'calculator-alt';
    case 'STRING':
    case 'BYTES':
      return 'text';
    case 'GEOGRAPHY':
      return 'map';
    default:
      return undefined;
  }
}
