import React from 'react';
import { QueryEditorProps } from '@grafana/data';
import { MyQuery, MyDataSourceOptions } from '../types';
import { InlineField, Input } from '@grafana/ui';

type Props = QueryEditorProps<any, MyQuery, MyDataSourceOptions>;

export const QueryEditor = ({ query, onChange, onRunQuery }: Props) => {
  const onQueryTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, queryText: e.currentTarget.value });
  };

  return (
    <div>
      <InlineField label="Query Text" tooltip="Enter a MongoDB filter or aggregation expression">
        <Input
          value={query.queryText || ''}
          onChange={onQueryTextChange}
          onBlur={onRunQuery}
          placeholder='{ "status": "active" }'
        />
      </InlineField>
    </div>
  );
};
