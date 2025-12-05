import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { Icon, PanelChrome, Stack, Tooltip, useStyles2 } from '@grafana/ui';

import {
  getDashboardAnalyticsAggregator,
  PanelAnalyticsMetrics,
} from '../../dashboard/services/DashboardAnalyticsAggregator';
import { getPanelIdForVizPanel } from '../utils/utils';

interface PanelPerformanceMetricsState extends SceneObjectState {
  metrics?: PanelAnalyticsMetrics;
}

export class PanelPerformanceMetrics extends SceneObjectBase<PanelPerformanceMetricsState> {
  static Component = PanelPerformanceMetricsRenderer;

  constructor() {
    super({});
    this.addActivationHandler(this.onActivate);
  }

  private onActivate = () => {
    const panel = this.parent;
    if (!panel || !(panel instanceof VizPanel)) {
      throw new Error('PanelPerformanceMetrics can be used only as title items for VizPanel');
    }

    const panelId = getPanelIdForVizPanel(panel);
    if (!panelId) {
      return;
    }

    const aggregator = getDashboardAnalyticsAggregator();
    const panelIdStr = String(panelId);

    // Subscribe to metrics updates - callback will be called with initial metrics if available
    this._subs.add(
      aggregator.subscribeToPanelMetrics(panelIdStr, (updatedMetrics) => {
        this.setState({ metrics: updatedMetrics });
      })
    );
  };

  public getPanel() {
    const panel = this.parent;

    if (panel && panel instanceof VizPanel) {
      return panel;
    }

    return null;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

function PanelPerformanceMetricsRenderer({ model }: SceneComponentProps<PanelPerformanceMetrics>) {
  const panel = model.getPanel();
  const styles = useStyles2(getStyles);
  const { metrics } = model.useState();
  const [fakeQueryTime, setFakeQueryTime] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Get last operation times (most recent operation in each array)
  const lastQueryTime =
    metrics && metrics.queryOperations.length > 0
      ? metrics.queryOperations[metrics.queryOperations.length - 1].duration
      : 0;
  const lastRenderTime =
    metrics && metrics.renderOperations.length > 0
      ? metrics.renderOperations[metrics.renderOperations.length - 1].duration
      : 0;
  const lastTransformTime =
    metrics && metrics.transformationOperations.length > 0
      ? metrics.transformationOperations[metrics.transformationOperations.length - 1].duration
      : 0;

  // Manage fake timer for query time
  useEffect(() => {
    // If we have a real query time, stop the fake timer
    if (lastQueryTime > 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setFakeQueryTime(0);
      startTimeRef.current = null;
      return;
    }

    // If no query operations yet, start the fake timer
    if (metrics && metrics.queryOperations.length === 0) {
      // Start timer if not already running
      if (!intervalRef.current) {
        startTimeRef.current = Date.now();
        intervalRef.current = setInterval(() => {
          if (startTimeRef.current) {
            setFakeQueryTime(Date.now() - startTimeRef.current);
          }
        }, 166); // Update every 166ms for smooth counting
      }
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [lastQueryTime, metrics]);

  // Use fake query time if real one is 0
  const displayQueryTime = lastQueryTime > 0 ? lastQueryTime : fakeQueryTime;
  const lastTotalTime = displayQueryTime + lastRenderTime + lastTransformTime;

  // Don't render if panel or metrics are not available (and no fake timer running)
  if (!panel || (!metrics && fakeQueryTime === 0)) {
    return null;
  }

  // Show component if we have any metrics or fake query time is running
  if (lastTotalTime === 0 && fakeQueryTime === 0) {
    return null;
  }

  const renderMetricRow = (label: string, current: number) => {
    return (
      <div>
        {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
        <strong>{label}:</strong> {formatDuration(current)}
      </div>
    );
  };

  const tooltipContent = (
    <div>
      {renderMetricRow('Query', displayQueryTime)}
      {renderMetricRow('Render', lastRenderTime)}
      {renderMetricRow('Transform', lastTransformTime)}
      <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
        {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
        <strong>Total:</strong> {formatDuration(lastTotalTime)}
      </div>
    </div>
  );

  const metricsText = [
    displayQueryTime > 0 && `Q:${formatDuration(displayQueryTime)}`,
    lastRenderTime > 0 && `R:${formatDuration(lastRenderTime)}`,
    lastTransformTime > 0 && `T:${formatDuration(lastTransformTime)}`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tooltip content={tooltipContent}>
      <PanelChrome.TitleItem className={styles.metrics}>
        <Stack gap={1} alignItems={'center'}>
          <Icon name="tachometer-fast" size="sm" />
          <div>{metricsText}</div>
        </Stack>
      </PanelChrome.TitleItem>
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    metrics: css({
      color: theme.colors.text.link,
      gap: theme.spacing(0.5),
      whiteSpace: 'nowrap',
      fontSize: theme.typography.bodySmall.fontSize,

      '&:hover': {
        color: theme.colors.emphasize(theme.colors.text.link, 0.03),
      },
    }),
  };
};
