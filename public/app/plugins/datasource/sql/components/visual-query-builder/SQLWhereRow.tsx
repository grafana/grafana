import React from 'react';
import useAsync from 'react-use/lib/useAsync';

import { QueryWithDefaults } from '../../defaults';
import { DB, SQLExpression, SQLQuery, TableSchema } from '../../types';
import { mapColumnTypeToIcon } from '../../utils/useColumns';
import { useSqlChange } from '../../utils/useSqlChange';

import { Config } from './AwesomeQueryBuilder';
import { WhereRow } from './WhereRow';

interface BQWhereRowProps {
  db: DB;
  query: QueryWithDefaults;
  onQueryChange: (query: SQLQuery) => void;
}

export function SQLWhereRow({ db, query, onQueryChange }: BQWhereRowProps) {
  const state = useAsync(async () => {
    if (!query.dataset || !query.table) {
      return;
    }
    const tableSchema = await db.tableSchema(query);
    return getFields(tableSchema);
  }, [db, query.dataset, query.table]);

  const { onSqlChange } = useSqlChange({ db, query, onQueryChange });

  return (
    <WhereRow
      // TODO: fix key that's used to force clean render or SQLWhereRow - otherwise it doesn't render operators correctly
      key={JSON.stringify(state.value)}
      config={{ fields: state.value || {} }}
      sql={query.sql}
      onSqlChange={(val: SQLExpression) => {
        onSqlChange(val);
      }}
    />
  );
}

function getFields(tableSchema: TableSchema) {
  const fields: Config['fields'] = {};
  tableSchema.schema?.forEach((field) => {
    let type = 'text';
    switch (field.type) {
      case 'BOOLEAN':
      case 'BOOL': {
        type = 'boolean';
        break;
      }
      case 'BYTES': {
        type = 'text';
        break;
      }
      case 'FLOAT':
      case 'FLOAT64':
      case 'INTEGER':
      case 'INT64':
      case 'NUMERIC':
      case 'BIGNUMERIC': {
        type = 'number';
        break;
      }
      case 'DATE': {
        type = 'date';
        break;
      }
      case 'DATETIME': {
        type = 'datetime';
        break;
      }
      case 'TIME': {
        type = 'time';
        break;
      }
      case 'TIMESTAMP': {
        type = 'datetime';
        break;
      }
      case 'GEOGRAPHY': {
        type = 'text';
        break;
      }
      default:
        break;
    }
    fields[field.name] = {
      type,
      valueSources: ['value'],
      mainWidgetProps: { customProps: { icon: mapColumnTypeToIcon(field.type) } },
    };
  });
  return fields;
}
