import { QueryEditorProps } from '@grafana/data';
import { SqlQueryEditorLazy, SQLOptions, SQLQuery, QueryHeaderProps } from '@grafana/sql';

import { PostgresDatasource } from './datasource';

const queryHeaderProps: Pick<QueryHeaderProps, 'dialect'> = { dialect: 'postgres' };

export function PostgresQueryEditor(props: QueryEditorProps<PostgresDatasource, SQLQuery, SQLOptions>) {
  return <SqlQueryEditorLazy {...props} queryHeaderProps={queryHeaderProps} />;
}
