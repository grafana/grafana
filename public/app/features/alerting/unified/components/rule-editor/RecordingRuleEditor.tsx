import { css } from '@emotion/css';
import React, { FC, useEffect, useState } from 'react';
import { useAsync } from 'react-use';

import { PanelData, CoreApp, GrafanaTheme2 } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery, LoadingState } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { isPromOrLokiQuery } from '../../utils/rule-form';

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

  const styles = useStyles2(getStyles);

  useEffect(() => {
    setData(panelData?.[queries[0]?.refId]);
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
    const dataSourceId = getDataSourceSrv().getInstanceSettings(dataSourceName)?.uid;

    if (!isPromOrLokiQuery(changedQuery) || !dataSourceId) {
      return;
    }

    const expr = changedQuery.expr;

    const merged = {
      ...query,
      refId: changedQuery.refId,
      queryType: changedQuery.queryType ?? '',
      datasourceUid: dataSourceId,
      expr,
      model: {
        refId: changedQuery.refId,
        expr,
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
      {queries.length && (
        <QueryEditor
          query={queries[0]}
          queries={queries}
          app={CoreApp.UnifiedAlerting}
          onChange={handleChangedQuery}
          onRunQuery={() => runQueries(queries)}
          datasource={dataSource}
        />
      )}

      {data && (
        <div className={styles.vizWrapper}>
          <VizWrapper data={data} />
        </div>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  vizWrapper: css`
    margin: ${theme.spacing(1, 0)};
  `,
});
