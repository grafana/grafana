import { css, cx } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import {
  CoreApp,
  DataQuery,
  DataSourcePluginContextProvider,
  GrafanaTheme2,
  TimeRange,
  getDataSourceRef,
} from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { SceneDataQuery, VizPanel, sceneGraph, SceneQueryRunner } from '@grafana/scenes';
import { ErrorBoundaryAlert, useStyles2 } from '@grafana/ui';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { QueryErrorAlert } from 'app/features/query/components/QueryErrorAlert';
import { QueryGroupOptionsEditor } from 'app/features/query/components/QueryGroupOptions';
import { QueryGroupOptions } from 'app/types/query';

import { PanelTimeRange } from '../../scene/panel-timerange/PanelTimeRange';
import { getQueryRunnerFor } from '../../utils/utils';
import { getUpdatedHoverHeader } from '../getPanelFrameOptions';

interface QueryDetailViewProps {
  panel: VizPanel;
  query: SceneDataQuery;
  queryIndex: number;
}

export function QueryDetailView({ panel, query, queryIndex }: QueryDetailViewProps) {
  const styles = useStyles2(getStyles);
  const [showOptions, setShowOptions] = useState(false);

  const dsSettings = useMemo(() => {
    try {
      return getDataSourceSrv().getInstanceSettings(query.datasource);
    } catch {
      return getDataSourceSrv().getInstanceSettings(null);
    }
  }, [query.datasource]);

  const queryRunner = getQueryRunnerFor(panel);
  const queryRunnerState = queryRunner?.useState();
  const timeRange: TimeRange | undefined = queryRunner?.state.$timeRange?.state.value;

  // Load datasource
  // FIXME: handle loading and error cases
  const { value: datasource } = useAsync(async () => {
    try {
      return await getDataSourceSrv().get(query.datasource);
    } catch {
      return await getDataSourceSrv().get();
    }
  }, [query.datasource]);

  // Subscribe to panel data
  const data = useMemo(() => {
    if (!queryRunnerState?.data) {
      return;
    }
    // Filter data for this specific query
    const panelData = queryRunnerState.data;
    const filteredSeries = panelData.series.filter((s) => s.refId === query.refId);
    return {
      ...panelData,
      series: filteredSeries,
      error: panelData.errors?.find((e) => e.refId === query.refId),
    };
  }, [queryRunnerState?.data, query.refId]);

  const handleQueryChange = useCallback(
    (updatedQuery: DataQuery) => {
      if (queryRunner) {
        const queries = queryRunner.state.queries || [];
        const newQueries = queries.map((q, idx) => (idx === queryIndex ? updatedQuery : q));
        queryRunner.setState({ queries: newQueries });
      }
    },
    [queryRunner, queryIndex]
  );

  const handleRunQuery = useCallback(() => {
    if (queryRunner) {
      queryRunner.runQueries();
    }
  }, [queryRunner]);

  // FIXME this should be a memo or some other structure, not a callback
  const buildQueryOptions = useCallback((): QueryGroupOptions => {
    if (!queryRunner) {
      return {
        queries: [],
        dataSource: dsSettings ? getDataSourceRef(dsSettings) : { type: undefined, uid: undefined },
      };
    }

    const timeRangeObj = sceneGraph.getTimeRange(panel);

    let timeRangeOpts: QueryGroupOptions['timeRange'] = {
      from: undefined,
      shift: undefined,
      hide: undefined,
    };

    if (timeRangeObj instanceof PanelTimeRange) {
      timeRangeOpts = {
        from: timeRangeObj.state.timeFrom,
        shift: timeRangeObj.state.timeShift,
        hide: timeRangeObj.state.hideTimeOverride,
      };
    }

    return {
      cacheTimeout: dsSettings?.meta.queryOptions?.cacheTimeout ? queryRunner.state.cacheTimeout : undefined,
      queryCachingTTL: dsSettings?.cachingConfig?.enabled ? queryRunner.state.queryCachingTTL : undefined,
      dataSource: {
        default: dsSettings?.isDefault,
        ...(dsSettings ? getDataSourceRef(dsSettings) : { type: undefined, uid: undefined }),
      },
      queries: queryRunner.state.queries,
      maxDataPoints: queryRunner.state.maxDataPoints,
      minInterval: queryRunner.state.minInterval,
      timeRange: timeRangeOpts,
    };
  }, [queryRunner, panel, dsSettings]);

  const handleQueryOptionsChange = useCallback(
    (options: QueryGroupOptions) => {
      if (!queryRunner) {
        return;
      }

      const dataObjStateUpdate: Partial<SceneQueryRunner['state']> = {};
      const panelStateUpdate: Partial<VizPanel['state']> = {};

      if (options.maxDataPoints !== queryRunner.state.maxDataPoints) {
        dataObjStateUpdate.maxDataPoints = options.maxDataPoints ?? undefined;
      }

      if (options.minInterval !== queryRunner.state.minInterval) {
        dataObjStateUpdate.minInterval = options.minInterval ?? undefined;
      }

      const timeFrom = options.timeRange?.from ?? undefined;
      const timeShift = options.timeRange?.shift ?? undefined;
      const hideTimeOverride = options.timeRange?.hide;

      if (timeFrom !== undefined || timeShift !== undefined) {
        panelStateUpdate.$timeRange = new PanelTimeRange({ timeFrom, timeShift, hideTimeOverride });
        panelStateUpdate.hoverHeader = getUpdatedHoverHeader(panel.state.title, panelStateUpdate.$timeRange);
      } else {
        panelStateUpdate.$timeRange = undefined;
        panelStateUpdate.hoverHeader = getUpdatedHoverHeader(panel.state.title, undefined);
      }

      if (options.cacheTimeout !== queryRunner.state.cacheTimeout) {
        dataObjStateUpdate.cacheTimeout = options.cacheTimeout;
      }

      if (options.queryCachingTTL !== queryRunner.state.queryCachingTTL) {
        dataObjStateUpdate.queryCachingTTL = options.queryCachingTTL;
      }

      panel.setState(panelStateUpdate);
      queryRunner.setState(dataObjStateUpdate);
      queryRunner.runQueries();
    },
    [queryRunner, panel]
  );

  const renderQueryEditor = () => {
    if (!datasource || !dsSettings) {
      return (
        <div className={styles.noEditor}>
          <Trans i18nKey="dashboard-scene.query-detail-view.loading">Loading data source...</Trans>
        </div>
      );
    }

    const QueryEditor = datasource.components?.QueryEditor;
    if (!QueryEditor) {
      return (
        <div className={styles.noEditor}>
          <Trans i18nKey="dashboard-scene.query-detail-view.no-editor">
            This data source does not have a query editor
          </Trans>
        </div>
      );
    }

    return (
      <DataSourcePluginContextProvider instanceSettings={dsSettings}>
        <ErrorBoundaryAlert boundaryName="query-editor">
          <QueryEditor
            query={query}
            datasource={datasource}
            onChange={handleQueryChange}
            onRunQuery={handleRunQuery}
            data={data}
            range={timeRange}
            app={CoreApp.PanelEditor}
          />
        </ErrorBoundaryAlert>
      </DataSourcePluginContextProvider>
    );
  };

  const error = data?.error || data?.errors?.find((e) => e.refId === query.refId);

  const queryOptions = buildQueryOptions();
  const panelData = queryRunnerState?.data;

  const renderCollapsedText = (): React.ReactNode | undefined => {
    if (!panelData) {
      return undefined;
    }

    let mdDesc = queryOptions.maxDataPoints ?? '';
    if (mdDesc === '' && panelData.request) {
      mdDesc = `auto = ${panelData.request.maxDataPoints}`;
    }

    const intervalDesc = panelData.request?.interval ?? queryOptions.minInterval;

    return (
      <>
        {
          <span className={styles.collapsedText}>
            <Trans i18nKey="query.query-group-options-editor.collapsed-max-data-points">MD = {{ mdDesc }}</Trans>
          </span>
        }
        {
          <span className={styles.collapsedText}>
            <Trans i18nKey="query.query-group-options-editor.collapsed-interval">Interval = {{ intervalDesc }}</Trans>
          </span>
        }
      </>
    );
  };

  return (
    <div className={styles.container}>
      <div className={cx(styles.contentWrapper, showOptions && styles.contentWrapperTwoColumn)}>
        <div className={styles.mainContent}>
          <QueryOperationRow
            id={`query-${query.refId}`}
            index={queryIndex}
            draggable={false}
            collapsable={false}
            isOpen={true}
            hideHeader={true}
          >
            <div className={styles.queryContent}>
              {renderQueryEditor()}
              {error && <QueryErrorAlert error={error} />}
            </div>
          </QueryOperationRow>
        </div>
        {showOptions && datasource && panelData && (
          <div className={styles.optionsColumn}>
            <QueryGroupOptionsEditor
              options={queryOptions}
              dataSource={datasource}
              data={panelData}
              onChange={handleQueryOptionsChange}
            />
          </div>
        )}
      </div>
      <div className={styles.footer}>
        {renderCollapsedText()}
        <button type="button" className={styles.optionsLink} onClick={() => setShowOptions(!showOptions)}>
          <Trans i18nKey="dashboard-scene.query-detail-view.options">Options</Trans>
        </button>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      width: '100%',
      height: '100%',
      position: 'relative',
    }),
    contentWrapper: css({
      display: 'grid',
      gridTemplateColumns: '1fr',
      width: '100%',
      minHeight: 'calc(100% - 36px)', // 36px for footer
    }),
    contentWrapperTwoColumn: css({
      gridTemplateColumns: '1fr 0.5fr',
    }),
    mainContent: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      overflow: 'scroll',
      padding: theme.spacing(2, 2, 0, 2),
    }),
    queryContent: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      minHeight: '100%',
    }),
    footer: css({
      display: 'flex',
      justifyContent: 'flex-end',
      borderTop: `1px solid ${theme.colors.border.weak}`,
      position: 'sticky',
      bottom: 0,
      zIndex: theme.zIndex.navbarFixed,
      padding: theme.spacing(1, 2),
      background: theme.colors.background.secondary,
    }),
    optionsLink: css({
      background: 'none',
      border: 'none',
      color: theme.colors.text.link,
      cursor: 'pointer',
      fontSize: theme.typography.bodySmall.fontSize,
      padding: 0,
      textDecoration: 'none',
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
    optionsColumn: css({
      display: 'flex',
      flexDirection: 'column',
      paddingLeft: theme.spacing(2),
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.secondary,
      padding: theme.spacing(2),
    }),
    noEditor: css({
      padding: theme.spacing(2),
      textAlign: 'center',
      color: theme.colors.text.secondary,
    }),
    collapsedText: css({
      marginInline: theme.spacing(1),
      fontSize: theme.typography.size.sm,
      color: theme.colors.text.secondary,
    }),
  };
};
