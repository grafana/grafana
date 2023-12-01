import { createSelector } from '@reduxjs/toolkit';
import React, { useCallback, useMemo } from 'react';

import { CoreApp, DataSourceInstanceSettings, TimeRange } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { useDispatch, useSelector } from 'app/types';

import { getDatasourceSrv } from '../plugins/datasource_srv';

import { QueryEditorRow } from './LogsAppQueryEditorRow';
import { changeQueries, runQueries } from './state/query';
import { getExploreItemSelector } from './state/selectors';

interface Props {
  exploreId: string;
  onChangeTime: (range: TimeRange) => void;
}

const makeSelectors = (exploreId: string) => {
  const exploreItemSelector = getExploreItemSelector(exploreId);
  return {
    getQueries: createSelector(exploreItemSelector, (s) => s!.queries),
    getQueryResponse: createSelector(exploreItemSelector, (s) => s!.queryResponse),
    getHistory: createSelector(exploreItemSelector, (s) => s!.history),
    getEventBridge: createSelector(exploreItemSelector, (s) => s!.eventBridge),
    getRange: createSelector(exploreItemSelector, (s) => s!.range),
    getDatasourceInstanceSettings: createSelector(
      exploreItemSelector,
      (s) => getDatasourceSrv().getInstanceSettings(s!.datasourceInstance?.uid)!
    ),
  };
};

export const QueryRows = ({ exploreId, onChangeTime }: Props) => {
  const dispatch = useDispatch();
  const { getQueries, getDatasourceInstanceSettings, getQueryResponse, getHistory, getEventBridge, getRange } = useMemo(
    () => makeSelectors(exploreId),
    [exploreId]
  );

  const queries = useSelector(getQueries);
  const query = queries[0];
  const dsSettings = useSelector(getDatasourceInstanceSettings);
  const queryResponse = useSelector(getQueryResponse);
  const history = useSelector(getHistory);
  const eventBridge = useSelector(getEventBridge);
  const range = useSelector(getRange);

  const onRunQueries = useCallback(() => {
    dispatch(runQueries({ exploreId }));
  }, [dispatch, exploreId]);

  const onChange = useCallback(
    (newQueries: DataQuery[]) => {
      dispatch(changeQueries({ exploreId, queries: newQueries }));
    },
    [dispatch, exploreId]
  );

  const onDataSourceChange = (dataSource: DataSourceInstanceSettings, index: number) => {
    onChange(
      [query].map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const dataSourceRef: DataSourceRef = {
          type: dataSource.type,
          uid: dataSource.uid,
        };

        if (item.datasource) {
          const previous = getDataSourceSrv().getInstanceSettings(item.datasource);

          if (previous?.type === dataSource.type) {
            return {
              ...item,
              datasource: dataSourceRef,
            };
          }
        }

        return {
          refId: item.refId,
          hide: item.hide,
          datasource: dataSourceRef,
        };
      })
    );
  };

  const dataSourceSettings = getDataSourceSettings(query, dsSettings);
  const onChangeDataSourceSettings = dsSettings.meta.mixed
    ? (settings: DataSourceInstanceSettings) => onDataSourceChange(settings, 0)
    : undefined;

  return (
    <QueryEditorRow
      data={queryResponse}
      query={query}
      queries={[query]}
      id={query.refId}
      index={0}
      dataSource={dataSourceSettings}
      onAddQuery={() => {}}
      onRemoveQuery={() => {}}
      onChange={(query) => onChange([query])}
      onRunQuery={onRunQueries}
      app={CoreApp.Explore}
      history={history}
      eventBus={eventBridge}
      collapsable={true}
      onChangeDataSource={onChangeDataSourceSettings}
      range={range}
      updateTimeRange={onChangeTime}
    />
  );
};

const getDataSourceSettings = (
  query: DataQuery,
  groupSettings: DataSourceInstanceSettings
): DataSourceInstanceSettings => {
  if (!query.datasource) {
    return groupSettings;
  }
  const querySettings = getDataSourceSrv().getInstanceSettings(query.datasource);
  return querySettings || groupSettings;
};
