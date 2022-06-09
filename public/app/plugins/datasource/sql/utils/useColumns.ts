import { useAsync } from 'react-use';

import { SelectableValue } from '@grafana/data';

import { QueryWithDefaults } from '../defaults';
import { DB } from '../types';

type Options = {
  db: DB;
  query: QueryWithDefaults;
  isOrderable?: boolean;
};

export function useColumns({ db, query, isOrderable = false }: Options) {
  const datasourceId = db.dsID();
  const { value: apiClient } = useAsync(async () => await db.init(datasourceId), []);

  const state = useAsync(async () => {
    const fields = await db.fields(query, isOrderable);
    const columns: SelectableValue[] = fields.map((f) => {
      return {
        value: f.name,
        label: f.name,
        icon: mapColumnTypeToIcon(f.type.toUpperCase()),
      };
    });

    return columns;
  }, [apiClient, query]);

  return state;
}

// TODO - move type mappings to db interface since they will vary per dbms
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
