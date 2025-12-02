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
import { Button, ErrorBoundaryAlert, Stack, useStyles2 } from '@grafana/ui';
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

    const optionItems: React.ReactNode[] = [];

    // Helper to render value with appropriate styling
    const renderValue = (value: string | number, isCustom: boolean) => (
      <span className={isCustom ? styles.collapsedTextValueCustom : styles.collapsedTextValue}>{value}</span>
    );

    // Helper to render the custom indicator (green circle)
    const renderCustomIndicator = (isCustom: boolean) =>
      isCustom ? <span className={styles.customIndicator} /> : null;

    // Max data points - custom if explicitly set
    const hasCustomMaxDataPoints = queryOptions.maxDataPoints !== undefined && queryOptions.maxDataPoints !== null;
    const mdDesc = queryOptions.maxDataPoints ?? panelData.request?.maxDataPoints ?? '-';
    optionItems.push(
      <span key="md" className={styles.collapsedText}>
        {renderCustomIndicator(hasCustomMaxDataPoints)}
        <span className={styles.collapsedTextLabel}>
          <Trans i18nKey="query.query-group-options-editor.collapsed-max-data-points-label">Max data points</Trans>
        </span>
        {' = '}
        {renderValue(mdDesc, hasCustomMaxDataPoints)}
      </span>
    );

    // Min interval - custom if explicitly set (not falling back to datasource default)
    const hasCustomMinInterval = !!queryOptions.minInterval;
    const minIntervalDesc = queryOptions.minInterval ?? datasource?.interval ?? 'No limit';
    optionItems.push(
      <span key="min-interval" className={styles.collapsedText}>
        {renderCustomIndicator(hasCustomMinInterval)}
        <span className={styles.collapsedTextLabel}>
          <Trans i18nKey="query.query-group-options-editor.collapsed-min-interval-label">Min interval</Trans>
        </span>
        {' = '}
        {renderValue(minIntervalDesc, hasCustomMinInterval)}
      </span>
    );

    // Interval - read-only, never custom (computed value)
    const intervalDesc = panelData.request?.interval ?? '-';
    optionItems.push(
      <span key="interval" className={styles.collapsedText}>
        {renderCustomIndicator(false)}
        <span className={styles.collapsedTextLabel}>
          <Trans i18nKey="query.query-group-options-editor.collapsed-interval-label">Interval</Trans>
        </span>
        {' = '}
        {renderValue(intervalDesc, false)}
      </span>
    );

    // Cache timeout - custom if explicitly set (not using default "60")
    if (dsSettings?.meta.queryOptions?.cacheTimeout) {
      const hasCustomCacheTimeout = !!queryOptions.cacheTimeout;
      const cacheTimeoutDesc = queryOptions.cacheTimeout ?? '60';
      optionItems.push(
        <span key="cache-timeout" className={styles.collapsedText}>
          {renderCustomIndicator(hasCustomCacheTimeout)}
          <span className={styles.collapsedTextLabel}>
            <Trans i18nKey="query.query-group-options-editor.collapsed-cache-timeout-label">Cache timeout</Trans>
          </span>
          {' = '}
          {renderValue(cacheTimeoutDesc, hasCustomCacheTimeout)}
        </span>
      );
    }

    // Cache TTL - custom if explicitly set (not using datasource default)
    if (datasource?.cachingConfig?.enabled) {
      const hasCustomCacheTTL = queryOptions.queryCachingTTL !== undefined && queryOptions.queryCachingTTL !== null;
      const cacheTTLDesc = queryOptions.queryCachingTTL ?? datasource.cachingConfig.TTLMs ?? '-';
      optionItems.push(
        <span key="cache-ttl" className={styles.collapsedText}>
          {renderCustomIndicator(hasCustomCacheTTL)}
          <span className={styles.collapsedTextLabel}>
            <Trans i18nKey="query.query-group-options-editor.collapsed-cache-ttl-label">Cache TTL</Trans>
          </span>
          {' = '}
          {renderValue(cacheTTLDesc, hasCustomCacheTTL)}
        </span>
      );
    }

    // Relative time - custom if explicitly set
    const hasCustomRelativeTime = !!queryOptions.timeRange?.from;
    const relativeTime = queryOptions.timeRange?.from ?? '1h';
    optionItems.push(
      <span key="relative-time" className={styles.collapsedText}>
        {renderCustomIndicator(hasCustomRelativeTime)}
        <span className={styles.collapsedTextLabel}>
          <Trans i18nKey="query.query-group-options-editor.collapsed-relative-time-label">Relative time</Trans>
        </span>
        {' = '}
        {renderValue(relativeTime, hasCustomRelativeTime)}
      </span>
    );

    // Time shift - custom if explicitly set
    const hasCustomTimeShift = !!queryOptions.timeRange?.shift;
    const timeShift = queryOptions.timeRange?.shift ?? '1h';
    optionItems.push(
      <span key="time-shift" className={styles.collapsedText}>
        {renderCustomIndicator(hasCustomTimeShift)}
        <span className={styles.collapsedTextLabel}>
          <Trans i18nKey="query.query-group-options-editor.collapsed-time-shift-label">Time shift</Trans>
        </span>
        {' = '}
        {renderValue(timeShift, hasCustomTimeShift)}
      </span>
    );

    return <>{optionItems}</>;
  };

  return (
    <div className={styles.container}>
      <div className={cx(styles.content, showOptions && styles.contentOptionsVisible)}>
        <QueryOperationRow
          id={`query-${query.refId}`}
          index={queryIndex}
          draggable={false}
          collapsable={false}
          isOpen={true}
          hideHeader={true}
          className={styles.queryOperationRow}
        >
          <div className={styles.queryContent}>
            {error && <QueryErrorAlert error={error} />}
            {renderQueryEditor()}
          </div>
        </QueryOperationRow>
        <div className={styles.optionsColumn}>
          <Stack gap={1} direction="column">
            <Button
              size="md"
              icon="angle-right"
              fill="text"
              variant="secondary"
              onClick={() => setShowOptions(!showOptions)}
              className={styles.optionsButton}
            >
              <Trans i18nKey="dashboard-scene.query-detail-view.query-options">Query Options</Trans>
            </Button>
            {datasource && panelData && (
              <QueryGroupOptionsEditor
                options={queryOptions}
                dataSource={datasource}
                data={panelData}
                onChange={handleQueryOptionsChange}
              />
            )}
          </Stack>
        </div>
      </div>
      {datasource && panelData && !showOptions && (
        <div className={styles.optionsFooter}>
          {renderCollapsedText()}
          <Button
            size="sm"
            icon="angle-left"
            fill="text"
            onClick={() => setShowOptions(!showOptions)}
            className={styles.optionsButton}
          >
            <Trans i18nKey="dashboard-scene.query-detail-view.options">Options</Trans>
          </Button>
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      width: '100%',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
    }),
    content: css({
      display: 'flex',
      flexDirection: 'row',
      height: '100%',
      width: 'calc(100% + 300px)',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['width'], {
          duration: theme.transitions.duration.short,
        }),
      },
    }),
    contentOptionsVisible: css({
      width: '100%',
    }),
    queryContent: css({
      padding: theme.spacing(2),
      height: '100%',
    }),
    queryOperationRow: css({
      marginBottom: '0 !important', // need to beat specificty in the underling component
      maxHeight: 'calc(100% - 32px)', // 32px for the footer
      width: 'calc(100% - 300px)',
      overflowY: 'auto',
    }),
    optionsFooter: css({
      height: '32px',
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      borderTop: `1px solid ${theme.colors.border.weak}`,
      position: 'sticky',
      bottom: 0,
      zIndex: theme.zIndex.navbarFixed,
      padding: theme.spacing(0.5, 2),
      background: theme.colors.background.secondary,
    }),
    optionsColumn: css({
      width: '300px',
      display: 'flex',
      flexDirection: 'column',
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.secondary,
      padding: theme.spacing(2),
    }),
    optionsButton: css({
      paddingLeft: 0,
      fontFamily: theme.typography.fontFamilyMonospace,
      textTransform: 'uppercase',
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
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      whiteSpace: 'nowrap',
    }),
    collapsedTextLabel: css({
      color: theme.colors.text.primary,
    }),
    collapsedTextValue: css({
      color: theme.colors.text.secondary,
    }),
    collapsedTextValueCustom: css({
      color: theme.visualization.getColorByName('green'),
    }),
    customIndicator: css({
      width: 6,
      height: 6,
      borderRadius: theme.shape.radius.circle,
      backgroundColor: theme.visualization.getColorByName('green'),
      flexShrink: 0,
    }),
  };
};
