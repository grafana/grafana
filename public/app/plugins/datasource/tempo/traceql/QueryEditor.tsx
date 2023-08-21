import { css } from '@emotion/css';
import { defaults } from 'lodash';
import React from 'react';

import { GrafanaTheme2, QueryEditorProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { InlineLabel, useStyles2 } from '@grafana/ui';

import { GroupByField } from '../SearchTraceQLEditor/GroupByField';
import { TempoDatasource } from '../datasource';
import { defaultQuery, MyDataSourceOptions, TempoQuery } from '../types';

import { TempoQueryBuilderOptions } from './TempoQueryBuilderOptions';
import { TraceQLEditor } from './TraceQLEditor';

type Props = QueryEditorProps<TempoDatasource, TempoQuery, MyDataSourceOptions>;

export function QueryEditor(props: Props) {
  const styles = useStyles2(getStyles);
  const query = defaults(props.query, defaultQuery);

  const onEditorChange = (value: string) => {
    props.onChange({ ...query, query: value });
  };

  return (
    <>
      <InlineLabel>
        Build complex queries using TraceQL to select a list of traces.{' '}
        <a rel="noreferrer" target="_blank" href="https://grafana.com/docs/tempo/latest/traceql/">
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
      {config.featureToggles.metricsSummary && (
        <div className={styles.groupByContainer}>
          <GroupByField datasource={props.datasource} onChange={props.onChange} query={query} />
        </div>
      )}
      <div className={styles.optionsContainer}>
        <TempoQueryBuilderOptions query={query} onChange={props.onChange} />
      </div>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  optionsContainer: css`
    margin-top: 10px;
  `,
  groupByContainer: css`
    margin-top: ${theme.spacing(1)};
  `,
});
