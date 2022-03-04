import React from 'react';
import { useAsync } from 'react-use';
import { css } from '@emotion/css';

import { rangeUtil, DataQuery, RawTimeRange, TimeRange } from '@grafana/data';
import { getDataSourceSrv, DataSourcePicker } from '@grafana/runtime';
import { TimeRangePicker } from '@grafana/ui';

interface QueryEditorProps {
  datasourceUid: string | null;
  query: DataQuery;
  onChangeQuery: (query: DataQuery) => void;
}

const QueryEditor = ({ datasourceUid, query, onChangeQuery }: QueryEditorProps) => {
  const state = useAsync(async () => {
    if (datasourceUid == null || datasourceUid === '') {
      return Promise.resolve(undefined);
    }
    return getDataSourceSrv().get(datasourceUid);
  }, [datasourceUid]);

  // if (datasourceUid == null) {
  //   return null;
  // }

  if (state.loading) {
    return <div>Loading datasource editor</div>;
  }

  if (state.error != null) {
    return <div>Error loading datasource editor</div>;
  }

  const { value: datasource } = state;

  if (datasource == null) {
    return <div>Datasource not found</div>;
  }

  const DSQueryEditor = datasource.components?.QueryEditor;

  if (DSQueryEditor == null) {
    return <div>Query editor not available for datasource</div>;
  }

  return (
    <DSQueryEditor
      // data={data}
      // range={timeRange}
      query={query}
      datasource={datasource}
      onChange={onChangeQuery}
      onRunQuery={() => {}}
    />
  );
};

export interface Props {
  datasourceUid: string | null;
  onChangeDatasource: (datasourceUid: string) => void;
  query: DataQuery;
  onChangeQuery: (query: DataQuery) => void;
  timeRange: RawTimeRange | TimeRange | null;
  onChangeTimeRange: (range: TimeRange) => void;
}

export const StoryboardDatasourceQueryEditor = ({
  datasourceUid,
  onChangeDatasource,
  query,
  onChangeQuery,
  timeRange,
  onChangeTimeRange,
}: Props) => (
  <div>
    <div
      className={css`
        display: flex;
      `}
    >
      <DataSourcePicker noDefault onChange={(ds) => onChangeDatasource(ds.uid)} current={datasourceUid} />
      {timeRange !== null && (
        <TimeRangePicker
          value={rangeUtil.convertRawToRange(timeRange)}
          onChange={onChangeTimeRange}
          onChangeTimeZone={() => {}}
          onMoveForward={() => {}}
          onMoveBackward={() => {}}
          onZoom={() => {}}
        />
      )}
    </div>
    <QueryEditor datasourceUid={datasourceUid} query={query} onChangeQuery={onChangeQuery} />
  </div>
);
