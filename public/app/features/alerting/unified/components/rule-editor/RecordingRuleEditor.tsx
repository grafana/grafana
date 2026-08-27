import { css } from '@emotion/css';
import { type FC, useCallback, useEffect, useState } from 'react';

import { CoreApp, type GrafanaTheme2, LoadingState, type PanelData } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useDataSourceInstance } from '@grafana/runtime/unstable';
import { type DataQuery } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { QueryErrorAlert } from 'app/features/query/components/QueryErrorAlert';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { LokiQueryType } from '../../../../loki-helpers/types';
import { isPromOrLokiQuery } from '../../utils/rule-form';

import { VizWrapper } from './VizWrapper';

export interface RecordingRuleEditorProps {
  queries: AlertQuery[];
  onChangeQuery: (updatedQueries: AlertQuery[]) => void;
  runQueries: () => void;
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

  const { error, isLoading: loading, dataSource } = useDataSourceInstance(dataSourceName);

  const handleChangedQuery = useCallback(
    (changedQuery: DataQuery) => {
      if (!isPromOrLokiQuery(changedQuery) || !dataSource) {
        return;
      }

      const [query] = queries;
      const { uid: dataSourceId, type } = dataSource;
      const isLoki = type === DataSourceType.Loki;
      const expr = changedQuery.expr;

      const merged = {
        ...query,
        ...changedQuery,
        datasourceUid: dataSourceId,
        expr,
        model: {
          expr,
          datasource: changedQuery.datasource,
          refId: changedQuery.refId,
          editorMode: changedQuery.editorMode,
          instant: changedQuery.instant,
          range: changedQuery.range,
          // Loki queries default to instant until the user explicitly picks range/instant
          queryType: isLoki ? changedQuery.queryType || LokiQueryType.Instant : changedQuery.queryType,
          legendFormat: changedQuery.legendFormat,
        },
      };
      onChangeQuery([merged]);
    },
    [dataSource, queries, onChangeQuery]
  );

  if (loading || dataSource?.name !== dataSourceName) {
    return null;
  }

  if (error || !dataSource || !dataSource?.components?.QueryEditor) {
    const errorMessage = error?.message || 'Data source plugin does not export any Query Editor component';
    return (
      <div>
        <Trans i18nKey="alerting.recording-rule-editor.error-no-query-editor">
          Could not load query editor due to: {{ errorMessage }}
        </Trans>
      </div>
    );
  }

  const QueryEditor = dataSource.components.QueryEditor;

  return (
    <>
      {queries.length && (
        <>
          <QueryEditor
            query={queries[0]}
            queries={queries}
            app={CoreApp.UnifiedAlerting}
            onChange={handleChangedQuery}
            onRunQuery={runQueries}
            datasource={dataSource}
          />
          {(data?.errors || []).map((err) => {
            return <QueryErrorAlert key={err.message} error={err} />;
          })}
        </>
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
  vizWrapper: css({
    margin: theme.spacing(1, 0),
  }),
});
