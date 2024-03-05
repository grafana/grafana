import React from 'react';

import { QueryEditorProps } from '@grafana/data';
import { SqlQueryEditor, SQLOptions, SQLQuery, QueryHeaderProps } from '@grafana/sql';

import { PostgresDatasource } from './datasource';

const queryHeaderProps: Pick<QueryHeaderProps, 'dialect'> = { dialect: 'postgres' };

export function PostgresQueryEditor(props: QueryEditorProps<PostgresDatasource, SQLQuery, SQLOptions>) {
  return <SqlQueryEditor {...props} queryHeaderProps={queryHeaderProps} />;
}
