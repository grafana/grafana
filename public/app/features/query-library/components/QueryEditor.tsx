import React, { useState } from 'react';

import { DataQuery, getDefaultTimeRange, LoadingState } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { QueryEditorRows } from 'app/features/query/components/QueryEditorRows';

type Props = {
  initialQueries: DataQuery[];
};

export const QueryEditor = ({ initialQueries }: Props) => {
  const [queries, setQueries] = useState(initialQueries);
  const ds_uid = queries[0].datasource?.uid;
  const dsSettings = getDataSourceSrv().getInstanceSettings(ds_uid);

  const data = {
    state: LoadingState.NotStarted,
    series: [],
    timeRange: getDefaultTimeRange(),
  };

  const onQueriesChange = (newQueries: DataQuery[]) => {
    setQueries(newQueries);
  };

  //TODO: add data source selector
  //TODO: add run button?
  //TODO: handle save button
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
