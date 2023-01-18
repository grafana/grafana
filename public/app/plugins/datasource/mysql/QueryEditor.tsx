import React from 'react';

import { QueryEditorProps } from '@grafana/data';
import { SqlQueryEditor } from 'app/features/plugins/sql/components/QueryEditor';
import { SQLOptions, SQLQuery } from 'app/features/plugins/sql/types';

import { MySqlDatasource } from './MySqlDatasource';

const queryHeaderProps: React.ComponentPropsWithoutRef<typeof SqlQueryEditor>['queryHeaderProps'] = {
  showEscapeControl: true,
};

export function QueryEditor(props: QueryEditorProps<MySqlDatasource, SQLQuery, SQLOptions>) {
  return <SqlQueryEditor {...props} queryHeaderProps={queryHeaderProps} />;
}
