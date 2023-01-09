import { css } from '@emotion/css';
import { defaults } from 'lodash';
import React from 'react';

import { QueryEditorProps } from '@grafana/data';
import { InlineLabel, useStyles2 } from '@grafana/ui';

import { TempoDatasource } from '../datasource';
import { defaultQuery, MyDataSourceOptions, TempoQuery } from '../types';

import { TraceQLEditor } from './TraceQLEditor';

type Props = QueryEditorProps<TempoDatasource, TempoQuery, MyDataSourceOptions>;

export function QueryEditor(props: Props) {
  const query = defaults(props.query, defaultQuery);

  const onEditorChange = (value: string) => {
    props.onChange({ ...query, query: value });
  };

  return (
    <div style={{ flex: 1 }}>
      <InlineLabel>
        Build complex queries using TraceQL to select a list of traces.{' '}
        <a
          rel="noreferrer"
          target="_blank"
          href="https://github.com/grafana/tempo/blob/main/docs/design-proposals/2022-04%20TraceQL%20Concepts.md"
        >
          Documentation
        </a>
      </InlineLabel>
      <TraceQLEditor
        placeholder="Enter a TraceQL query or trace ID (run with Shift+Enter)"
        value={query.query}
        onChange={onEditorChange}
        datasource={props.datasource}
        onRunQuery={props.onRunQuery}
      />
    </div>
  );
}
