import React from 'react';

import { DataQuery, getDefaultTimeRange, LoadingState } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { QueryEditorRows } from 'app/features/query/components/QueryEditorRows';

type Props = {
  queries: DataQuery[];
};

export const QueryEditor = ({ queries }: Props) => {
  const ds_uid = queries[0].datasource?.uid;
  const dsSettings = getDataSourceSrv().getInstanceSettings(ds_uid);

  const data = {
    state: LoadingState.NotStarted,
    series: [],
    timeRange: getDefaultTimeRange(),
  };

  //TODO: handle query changing
  const onQueriesChange = (queries: DataQuery[]) => {
    console.log('yo');
    // this.onChange({ queries });
    // this.setState({ queries });
  };

  //TODO: add data source selector
  //TODO: add run button?
  return (
    <div>
      <QueryEditorRows
        queries={queries}
        dsSettings={dsSettings!}
        onQueriesChange={onQueriesChange}
        onAddQuery={() => {}}
        onRunQueries={() => {}}
        data={data}
      />
    </div>
  );
};
