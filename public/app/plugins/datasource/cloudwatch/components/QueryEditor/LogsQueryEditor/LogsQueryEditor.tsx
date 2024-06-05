import { css } from '@emotion/css';
import { memo } from 'react';

import { QueryEditorProps } from '@grafana/data';
import { InlineFormLabel } from '@grafana/ui';

import { CloudWatchDatasource } from '../../../datasource';
import { CloudWatchJsonData, CloudWatchLogsQuery, CloudWatchQuery } from '../../../types';

import { CloudWatchLink } from './CloudWatchLink';
import CloudWatchLogsQueryField from './LogsQueryField';

type Props = QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData> & {
  query: CloudWatchLogsQuery;
};

const labelClass = css`
  margin-left: 3px;
  flex-grow: 0;
`;

export const CloudWatchLogsQueryEditor = memo(function CloudWatchLogsQueryEditor(props: Props) {
  const { query, data, datasource } = props;

  return (
    <CloudWatchLogsQueryField
      {...props}
      ExtraFieldElement={
        <InlineFormLabel className={`gf-form-label--btn ${labelClass}`} width="auto" tooltip="Link to Graph in AWS">
          <CloudWatchLink query={query} panelData={data} datasource={datasource} />
        </InlineFormLabel>
      }
    />
  );
});

export default CloudWatchLogsQueryEditor;
