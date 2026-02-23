import { useAsync } from 'react-use';

import { SelectableValue, TypedVariableModel } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { QueryWithDefaults } from '../../defaults';
import { DB, SQLExpression, SQLQuery, SQLSelectableValue } from '../../types';
import { useSqlChange } from '../../utils/useSqlChange';

import { Config } from './AwesomeQueryBuilder';
import { WhereRow } from './WhereRow';

interface WhereRowProps {
  query: QueryWithDefaults;
  fields: SelectableValue[];
  onQueryChange: (query: SQLQuery) => void;
  db: DB;
}

export function SQLWhereRow({ query, fields, onQueryChange, db }: WhereRowProps) {
  const state = useAsync(async () => {
    return mapFieldsToTypes(fields);
  }, [fields]);

  const { onSqlChange } = useSqlChange({ query, onQueryChange, db });

  return (
    <WhereRow
      // TODO: fix key that's used to force clean render or SQLWhereRow - otherwise it doesn't render operators correctly
      key={JSON.stringify(state.value)}
      config={{ fields: state.value || {} }}
      sql={query.sql!}
      onSqlChange={(val: SQLExpression) => {
        const templateVars = getTemplateSrv().getVariables();

        removeQuotesForMultiVariables(val, templateVars);

        onSqlChange(val);
      }}
    />
  );
}

// needed for awesome query builder
function mapFieldsToTypes(columns: SQLSelectableValue[]) {
  const fields: Config['fields'] = {};
  for (const col of columns) {
    fields[col.value] = {
      type: col.raqbFieldType || 'text',
      valueSources: ['value'],
      mainWidgetProps: { customProps: { icon: col.icon } },
    };
  }
  return fields;
}

export function removeQuotesForMultiVariables(val: SQLExpression, templateVars: TypedVariableModel[]) {
  const multiVariableInWhereString = (tv: TypedVariableModel) =>
    'multi' in tv &&
    tv.multi &&
    (val.whereString?.includes(`\${${tv.name}}`) || val.whereString?.includes(`$${tv.name}`));

  if (templateVars.some((tv) => multiVariableInWhereString(tv))) {
    val.whereString = val.whereString?.replaceAll("')", ')');
    val.whereString = val.whereString?.replaceAll("('", '(');
  }
}
