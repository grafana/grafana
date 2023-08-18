import { css } from '@emotion/css';
import React, { memo } from 'react';

import { AbsoluteTimeRange, QueryEditorProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { InlineFormLabel } from '@grafana/ui';

import { CloudWatchDatasource } from '../../../datasource';
import { CloudWatchJsonData, CloudWatchLogsQuery, CloudWatchQuery } from '../../../types';

import { CloudWatchLink } from './CloudWatchLink';
import CloudWatchLogsQueryFieldMonaco from './LogsQueryField';
import CloudWatchLogsQueryField from './LogsQueryFieldOld';

type Props = QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData> & {
  query: CloudWatchLogsQuery;
};

const labelClass = css`
  margin-left: 3px;
  flex-grow: 0;
`;

export const CloudWatchLogsQueryEditor = memo(function CloudWatchLogsQueryEditor(props: Props) {
  const { query, data, datasource, exploreId } = props;

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

  return config.featureToggles.cloudWatchLogsMonacoEditor ? (
    <CloudWatchLogsQueryFieldMonaco
      {...props}
      ExtraFieldElement={
        <InlineFormLabel className={`gf-form-label--btn ${labelClass}`} width="auto" tooltip="Link to Graph in AWS">
          <CloudWatchLink query={query} panelData={data} datasource={datasource} />
        </InlineFormLabel>
      }
    />
  ) : (
    <CloudWatchLogsQueryField
      {...props}
      exploreId={exploreId}
      history={[]}
      absoluteRange={absolute}
      ExtraFieldElement={
        <InlineFormLabel className={`gf-form-label--btn ${labelClass}`} width="auto" tooltip="Link to Graph in AWS">
          <CloudWatchLink query={query} panelData={data} datasource={datasource} />
        </InlineFormLabel>
      }
    />
  );
});

export default CloudWatchLogsQueryEditor;
