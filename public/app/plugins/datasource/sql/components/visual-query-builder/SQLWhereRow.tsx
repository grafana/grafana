import React from 'react';
import useAsync from 'react-use/lib/useAsync';

import { SelectableValue } from '@grafana/data';

import { QueryWithDefaults } from '../../defaults';
import { DB, SQLExpression, SQLQuery } from '../../types';
import { mapColumnTypeToIcon } from '../../utils/useColumns';
import { useSqlChange } from '../../utils/useSqlChange';

import { Config } from './AwesomeQueryBuilder';
import { WhereRow } from './WhereRow';

interface WhereRowProps {
  db: DB;
  query: QueryWithDefaults;
  onQueryChange: (query: SQLQuery) => void;
}

export function SQLWhereRow({ db, query, onQueryChange }: WhereRowProps) {
  const state = useAsync(async () => {
    // TODO - move check to db.fields impl.  big query etc will need to check project etc
    if (!query.dataset || !query.table) {
      return;
    }
    const fields = await db.fields(query);
    return getFields(fields);
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

// TODO - move type mappings to db interface since it will vary per dbms
function getFields(columns: SelectableValue[]) {
  const fields: Config['fields'] = {};
  for (const col of columns) {
    let type = 'text';
    switch (col.type) {
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

    fields[col.value] = {
      type,
      valueSources: ['value'],
      mainWidgetProps: { customProps: { icon: mapColumnTypeToIcon(col.type.toUpperCase()) } },
    };
  }
  return fields;
}
