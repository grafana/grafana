import { css } from '@emotion/css';
import { type FC, useCallback, useEffect, useState } from 'react';
import Skeleton from 'react-loading-skeleton';

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
import { useSlowQuery } from '../../hooks/useSlowQuery';
import { isPromOrLokiQuery } from '../../utils/rule-form';

import { VizWrapper } from './VizWrapper';

// Loads faster than this show nothing, so a cached data source does not flash a loading indicator.
const LOADING_INDICATOR_DELAY_MS = 300;

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
  // The hook keeps the previous instance for one render after dataSourceUid changes
  const isLoadingEditor = isLoading || (dataSource !== undefined && dataSource.uid !== dataSourceUid);
  const isSlow = useSlowQuery(isLoadingEditor, { threshold: LOADING_INDICATOR_DELAY_MS });

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

  if (isLoadingEditor) {
    return isSlow ? <RecordingRuleEditorSkeleton /> : null;
  }

  if (error) {
    return <LoadError message={error.message} />;
  }

  if (!dataSource) {
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

function RecordingRuleEditorSkeleton() {
  return (
    <div data-testid="recording-rule-editor-skeleton">
      <Skeleton width={200} height={24} />
      <Skeleton height={64} />
    </div>
  );
}

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
