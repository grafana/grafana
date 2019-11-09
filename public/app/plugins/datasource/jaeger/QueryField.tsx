import React from 'react';
import { JaegerDatasource, JaegerQuery } from './datasource';
import { ExploreQueryFieldProps } from '@grafana/data';

type Props = ExploreQueryFieldProps<JaegerDatasource, JaegerQuery>;

export const QueryField = (props: Props) => (
  <div className={'slate-query-field__wrapper'}>
    <div className="slate-query-field">
      <input
        style={{ width: '100%' }}
        value={props.query.query || ''}
        onChange={e =>
          props.onChange({
            ...props.query,
            query: e.currentTarget.value,
          })
        }
      />
    </div>
  </div>
);
