import { defaults } from 'lodash';
import React from 'react';

import { QueryEditorProps } from '@grafana/data';

import { TempoDatasource, TempoQuery } from '../datasource';
import { defaultQuery, MyDataSourceOptions } from '../types';

import { TraceQLEditor } from './TraceQLEditor';

type Props = QueryEditorProps<TempoDatasource, TempoQuery, MyDataSourceOptions>;

export function QueryEditor(props: Props) {
  function onEditorChange(value: string) {
    props.onChange({ ...props.query, query: value });
  }

  let query = defaults(props.query, defaultQuery);

  return (
    <div className="gf-form">
      <TraceQLEditor value={query.query} onChange={onEditorChange} datasource={props.datasource} />
    </div>
  );
}
