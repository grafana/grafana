import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { Icon, PanelChrome, Stack, Tooltip, useStyles2 } from '@grafana/ui';

import {
  getDashboardAnalyticsAggregator,
  PanelAnalyticsMetrics,
} from '../../dashboard/services/DashboardAnalyticsAggregator';
import { isPanelProfilingEnabled } from '../../dashboard/services/DashboardProfiler';
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
    if (panelId == null || isNaN(panelId)) {
      return;
    }

    const aggregator = getDashboardAnalyticsAggregator();
    const panelIdStr = String(panelId);

    // Subscribe to metrics updates - defer initial callback to avoid setState during render
    this._subs.add(
      aggregator.subscribeToPanelMetrics(panelIdStr, (updatedMetrics) => {
        // Defer state update to avoid React warning about updating during render
        setTimeout(() => {
          this.setState({ metrics: updatedMetrics });
        }, 0);
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
  const [isProfilingEnabled, setIsProfilingEnabled] = useState(isPanelProfilingEnabled());
  const profilingStateRef = useRef(isProfilingEnabled);

  // Update ref when state changes
  useEffect(() => {
    profilingStateRef.current = isProfilingEnabled;
  }, [isProfilingEnabled]);

  // Watch for profiling state changes (when toggled via hotkey)
  useEffect(() => {
    // Poll for profiling state changes - this allows the component to react when profiling is toggled
    const checkProfilingState = () => {
      const currentState = isPanelProfilingEnabled();
      // Compare against ref to avoid stale closure
      if (currentState !== profilingStateRef.current) {
        setIsProfilingEnabled(currentState);
      }
    };

    // Check immediately and then periodically
    checkProfilingState();
    const interval = setInterval(checkProfilingState, 100);

    return () => clearInterval(interval);
  }, []); // Empty dependency array - polling should run once and persist

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

  const lastTotalTime = lastQueryTime + lastRenderTime + lastTransformTime;

  // Don't render if panel is not available
  if (!panel) {
    return null;
  }

  // If profiling is disabled, don't show the component at all
  if (!isProfilingEnabled) {
    return null;
  }

  // If profiling is enabled, always show the component (even with 0 values)

  const renderMetricRow = (label: string, current: number) => {
    return (
      <div>
        {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
        <strong>{label}:</strong> {formatDuration(current)}
      </div>
    );
  };

  // Check if there are any transformation operations
  const hasTransformations = metrics && metrics.transformationOperations.length > 0;

  const tooltipContent = (
    <div>
      {renderMetricRow('Query', lastQueryTime)}
      {hasTransformations && renderMetricRow('Transform', lastTransformTime)}
      {renderMetricRow('Render', lastRenderTime)}
      <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
        {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
        <strong>Total:</strong> {formatDuration(lastTotalTime)}
      </div>
    </div>
  );

  // Show metrics text - if profiling is enabled, show all metrics even if 0
  // Transform is only shown if there are transformation operations
  // Otherwise, only show non-zero metrics
  const metricsText = isProfilingEnabled
    ? [
        `Q:${formatDuration(lastQueryTime)}`,
        hasTransformations && `T:${formatDuration(lastTransformTime)}`,
        `R:${formatDuration(lastRenderTime)}`,
      ]
        .filter(Boolean)
        .join(' ')
    : [
        lastQueryTime > 0 && `Q:${formatDuration(lastQueryTime)}`,
        lastTransformTime > 0 && `T:${formatDuration(lastTransformTime)}`,
        lastRenderTime > 0 && `R:${formatDuration(lastRenderTime)}`,
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
