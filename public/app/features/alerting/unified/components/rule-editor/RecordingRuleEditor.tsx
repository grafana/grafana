import { css } from '@emotion/css';
import { type FC, useCallback, useEffect, useState } from 'react';

import { CoreApp, type GrafanaTheme2, LoadingState, type PanelData } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useDataSourceInstance } from '@grafana/runtime';
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
  dataSourceUid: string;
}

export const RecordingRuleEditor: FC<RecordingRuleEditorProps> = ({
  queries,
  onChangeQuery,
  runQueries,
  panelData,
  dataSourceUid,
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

  const { dataSource, isLoading, error } = useDataSourceInstance(dataSourceUid);

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
          // Instant and range are used by Prometheus queries
          instant: changedQuery.instant,
          range: changedQuery.range,
          // Query type is used by Loki queries
          // On first render/when creating a recording rule, the query type is not set
          // unless the user has changed it betwee range/instant. The cleanest way to handle this
          // is to default to instant, or whatever the changed type is
          queryType: isLoki ? changedQuery.queryType || LokiQueryType.Instant : changedQuery.queryType,
          legendFormat: changedQuery.legendFormat,
        },
      };
      onChangeQuery([merged]);
    },
    [dataSource, queries, onChangeQuery]
  );

  if (isLoading) {
    return null;
  }

  if (error) {
    return <LoadError message={error.message} />;
  }

  // The hook keeps the previous instance for one render after dataSourceUid changes
  if (!dataSource || dataSource.uid !== dataSourceUid) {
    return null;
  }

  const QueryEditor = dataSource.components?.QueryEditor;
  if (!QueryEditor) {
    return <LoadError message="Data source plugin does not export any Query Editor component" />;
  }

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

function LoadError({ message: errorMessage }: { message: string }) {
  return (
    <div>
      <Trans i18nKey="alerting.recording-rule-editor.error-no-query-editor">
        Could not load query editor due to: {{ errorMessage }}
      </Trans>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  vizWrapper: css({
    margin: theme.spacing(1, 0),
  }),
});
