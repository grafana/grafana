import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import { updatePanelIframeUrl } from '../../state/crdtSlice';
import { selectPanels } from '../../state/selectors';

interface ExploreMapMetricsDrilldownPanelProps {
  exploreId: string;
  width: number;
  height: number;
}

export function ExploreMapMetricsDrilldownPanel({ exploreId, width, height }: ExploreMapMetricsDrilldownPanelProps) {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const [isInitialized, setIsInitialized] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Find the panel with this exploreId to get saved state
  const panel = useSelector((state) => {
    const panels = selectPanels(state.exploreMapCRDT);
    return Object.values(panels).find((p) => p.exploreId === exploreId);
  });

  // Build iframe URL for metrics drilldown - use saved URL if available, otherwise default
  // IMPORTANT: Only compute this once on mount to prevent iframe reloads
  const [metricsDrilldownUrl] = useState(() => {
    // If we have a saved iframe URL from previous session, use it
    if (panel?.mode === 'metrics-drilldown' && panel?.iframeUrl) {
      return panel.iframeUrl;
    }
    // Otherwise, construct the default URL
    const origin = window.location.origin;
    const subUrl = config.appSubUrl || '';
    const appPath = '/a/grafana-metricsdrilldown-app';
    return `${origin}${subUrl}${appPath}`;
  });

  // Initialize immediately for metrics drilldown panels
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Auto-save iframe URL changes for metrics-drilldown panels
  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    const panelId = panel?.id;
    if (!panelId) {
      return;
    }

    let lastSavedUrl = panel?.iframeUrl || '';

    const checkAndSaveUrl = () => {
      const iframe = iframeRef.current;
      if (!iframe) {
        return;
      }

      try {
        const currentUrl = iframe.contentWindow?.location.href;
        if (currentUrl && currentUrl !== lastSavedUrl) {
          lastSavedUrl = currentUrl;
          dispatch(
            updatePanelIframeUrl({
              panelId,
              iframeUrl: currentUrl,
            })
          );
        } else if (!currentUrl) {
          console.log('No URL detected');
        }
      } catch (e) {
        console.error('Cannot read iframe URL:', e);
      }
    };

    // Start checking periodically (every 2 seconds)
    const intervalId = setInterval(checkAndSaveUrl, 2000);

    // Also check immediately
    setTimeout(checkAndSaveUrl, 100);

    return () => {
      clearInterval(intervalId);
    };
    // Intentionally not including panel.iframeUrl to avoid re-creating interval on every save
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, panel?.id, dispatch]);

  if (!isInitialized) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Trans i18nKey="explore-map.panel.initializing">Initializing...</Trans>
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.container}
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      <iframe
        ref={iframeRef}
        src={metricsDrilldownUrl}
        title={t('explore-map.panel.metrics-drilldown', 'Metrics Drilldown')}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      position: 'relative',
    }),
    loading: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.body.fontSize,
    }),
  };
};

