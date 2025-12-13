import { QueryEditorProps } from '@grafana/data';
import { QueryHeaderProps, SQLOptions, SQLQuery, SqlQueryEditorLazy } from '@grafana/sql';

import { PostgresDatasource } from './datasource';
import { migrateVariableQuery } from './migrations';

const queryHeaderProps: Pick<QueryHeaderProps, 'dialect' | 'hideRunButton' | 'hideFormatSelector'> = {
  dialect: 'postgres',
  hideRunButton: true,
  hideFormatSelector: true,
};

export function VariableQueryEditor(props: QueryEditorProps<PostgresDatasource, SQLQuery, SQLOptions>) {
  const newProps = {
    ...props,
    query: migrateVariableQuery(props.query),
    queryHeaderProps,
    isVariableQuery: true,
  };
  return <SqlQueryEditorLazy {...newProps} />;
}
