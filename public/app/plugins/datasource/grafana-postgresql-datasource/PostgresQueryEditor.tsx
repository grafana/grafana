import type { QueryEditorProps } from '@grafana/data/types';
import { SqlQueryEditorLazy, type SQLOptions, type SQLQuery, type QueryHeaderProps } from '@grafana/sql';

import { type PostgresDatasource } from './datasource';

const queryHeaderProps: Pick<QueryHeaderProps, 'dialect'> = { dialect: 'postgres' };

export function PostgresQueryEditor(props: QueryEditorProps<PostgresDatasource, SQLQuery, SQLOptions>) {
  return <SqlQueryEditorLazy {...props} queryHeaderProps={queryHeaderProps} />;
}
