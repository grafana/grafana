// Libraries
import { css } from '@emotion/css';
import React, { memo } from 'react';

// Types
import { AbsoluteTimeRange, QueryEditorProps } from '@grafana/data';
import { InlineFormLabel } from '@grafana/ui';

import { CloudWatchDatasource } from '../datasource';
import { CloudWatchJsonData, CloudWatchLogsQuery, CloudWatchQuery } from '../types';

import CloudWatchLink from './CloudWatchLink';
import CloudWatchLogsQueryField from './LogsQueryField';

type Props = QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData> & {
  query: CloudWatchLogsQuery;
};

const labelClass = css`
  margin-left: 3px;
  flex-grow: 0;
`;

export const CloudWatchLogsQueryEditor = memo(function CloudWatchLogsQueryEditor(props: Props) {
  const { query, data, datasource, onRunQuery, onChange, exploreId } = props;

  let absolute: AbsoluteTimeRange;
  if (data?.request?.range?.from) {
    const { range } = data.request;
    absolute = {
      from: range.from.valueOf(),
      to: range.to.valueOf(),
    };
  } else {
    absolute = {
      from: Date.now() - 10000,
      to: Date.now(),
    };
  }

  return (
    <CloudWatchLogsQueryField
      exploreId={exploreId}
      datasource={datasource}
      query={query}
      onChange={onChange}
      onRunQuery={onRunQuery}
      history={[]}
      data={data}
      absoluteRange={absolute}
      ExtraFieldElement={
        <InlineFormLabel className={`gf-form-label--btn ${labelClass}`} width="auto" tooltip="Link to Graph in AWS">
          <CloudWatchLink query={query as CloudWatchLogsQuery} panelData={data} datasource={datasource} />
        </InlineFormLabel>
      }
    />
  );
});

export default CloudWatchLogsQueryEditor;
