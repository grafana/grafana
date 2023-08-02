import React from 'react';

import { Input } from '@grafana/ui';

import { InfluxQuery } from '../../../../types';

type Props = {
  onChange: (query: InfluxQuery) => void;
  onRunQuery: () => void;
  query: InfluxQuery;
};

// Flight SQL Editor
export const FSQLEditor = (props: Props) => {
  const onSQLQueryChange = (query?: string) => {
    if (query) {
      props.onChange({ ...props.query, query, resultFormat: 'table' });
    }
    props.onRunQuery();
  };
  return (
    <div>
      <Input
        value={props.query.query}
        onBlur={(e) => onSQLQueryChange(e.currentTarget.value)}
        onChange={(e) => onSQLQueryChange(e.currentTarget.value)}
      />
      <br />
      <button onClick={() => onSQLQueryChange()}>run query</button>
    </div>
  );
};
