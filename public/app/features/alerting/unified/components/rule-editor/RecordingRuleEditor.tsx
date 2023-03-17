import React, { FC, useEffect, useState } from 'react';
import { useAsync } from 'react-use';

import { PanelData, CoreApp } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery, LoadingState } from '@grafana/schema';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { TABLE, TIMESERIES } from '../../utils/constants';
import { SupportedPanelPlugins } from '../PanelPluginsButtonGroup';

import { VizWrapper } from './VizWrapper';

export interface RecordingRuleEditorProps {
  queries: AlertQuery[];
  onChangeQuery: (updatedQueries: AlertQuery[]) => void;
  runQueries: (queries: AlertQuery[]) => void;
  panelData: Record<string, PanelData>;
  dataSourceName: string;
}

export const RecordingRuleEditor: FC<RecordingRuleEditorProps> = ({
  queries,
  onChangeQuery,
  runQueries,
  panelData,
  dataSourceName,
}) => {
  const [data, setData] = useState<PanelData>({
    series: [],
    state: LoadingState.NotStarted,
    timeRange: getTimeSrv().timeRange(),
  });

  const isExpression = isExpressionQuery(queries[0].model);

  const [pluginId, changePluginId] = useState<SupportedPanelPlugins>(isExpression ? TABLE : TIMESERIES);

  useEffect(() => {
    setData(panelData?.[queries[0].refId]);
  }, [panelData, queries]);

  const {
    error,
    loading,
    value: dataSource,
  } = useAsync(() => {
    return getDataSourceSrv().get(dataSourceName);
  }, [dataSourceName]);

  const handleChangedQuery = (changedQuery: DataQuery) => {
    const query = queries[0];

    const merged = {
      ...query,
      refId: changedQuery.refId,
      queryType: query.model.queryType ?? '',
      //@ts-ignore
      expr: changedQuery?.expr,
      model: {
        refId: changedQuery.refId,
        //@ts-ignore
        expr: changedQuery?.expr,
        editorMode: 'code',
      },
    };
    onChangeQuery([merged]);
  };

  if (loading || dataSource?.name !== dataSourceName) {
    return null;
  }

  const dsi = getDataSourceSrv().getInstanceSettings(dataSourceName);

  if (error || !dataSource || !dataSource?.components?.QueryEditor || !dsi) {
    const errorMessage = error?.message || 'Data source plugin does not export any Query Editor component';
    return <div>Could not load query editor due to: {errorMessage}</div>;
  }

  const QueryEditor = dataSource.components.QueryEditor;

  return (
    <>
      <QueryEditor
        query={queries[0]}
        queries={queries}
        app={CoreApp.UnifiedAlerting}
        onChange={handleChangedQuery}
        onRunQuery={() => runQueries(queries)}
        datasource={dataSource}
      />

      {data && <VizWrapper data={data} currentPanel={pluginId} changePanel={changePluginId} />}
    </>
  );
};
