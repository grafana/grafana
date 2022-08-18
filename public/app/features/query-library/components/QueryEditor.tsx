import { css } from '@emotion/css';
import React, { useState } from 'react';

import { DataQuery, getDefaultTimeRange, GrafanaTheme2, LoadingState } from '@grafana/data';
import { DataSourcePicker, getDataSourceSrv } from '@grafana/runtime';
import { HorizontalGroup, useStyles2 } from '@grafana/ui';
import { QueryEditorRows } from 'app/features/query/components/QueryEditorRows';

import { SavedQuery } from '../api/SavedQueriesApi';

type Props = {
  savedQuery: SavedQuery<DataQuery>;
};

export const QueryEditor = ({ savedQuery }: Props) => {
  const styles = useStyles2(getStyles);
  const [queries, setQueries] = useState(savedQuery.queries);
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

  // TODO: add change data source functionality
  const onChangeDataSource = () => {};

  //TODO: handle save button
  return (
    <div>
      <HorizontalGroup>
        <div className={styles.dataSourceHeader}>Data source</div>
        <div className={styles.dataSourcePickerWrapper}>
          <DataSourcePicker
            onChange={onChangeDataSource}
            current={dsSettings!}
            metrics={true}
            mixed={true}
            dashboard={true}
            variables={true}
          />
        </div>
      </HorizontalGroup>
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

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    dataSourceHeader: css`
      font-size: ${theme.typography.size.sm};
      margin-top: 5px;
      margin-bottom: 20px;
    `,
    dataSourcePickerWrapper: css`
      margin-top: 5px;
      margin-bottom: 20px;
    `,
  };
};
