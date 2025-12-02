import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import { updatePanelIframeUrl } from '../../state/crdtSlice';
import { selectPanels } from '../../state/selectors';

interface ExploreMapDrilldownPanelProps {
  exploreId: string;
  width: number;
  height: number;
  mode: 'traces-drilldown' | 'metrics-drilldown' | 'profiles-drilldown' | 'logs-drilldown';
  appPath: string;
  titleKey: string;
  titleDefault: string;
}

export function ExploreMapDrilldownPanel({
  exploreId,
  width,
  height,
  mode,
  appPath,
  titleKey,
  titleDefault,
}: ExploreMapDrilldownPanelProps) {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const [isInitialized, setIsInitialized] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Find the panel with this exploreId to get saved state
  const panel = useSelector((state) => {
    const panels = selectPanels(state.exploreMapCRDT);
    return Object.values(panels).find((p) => p.exploreId === exploreId);
  });

  // Initialize URL from panel state or default
  const initialUrl = (() => {
    const origin = window.location.origin;
    const subUrl = config.appSubUrl || '';
    return `${origin}${subUrl}${appPath}`;
  })();

  const [drilldownUrl, setDrilldownUrl] = useState(initialUrl);
  const lastLocalUrlRef = useRef<string | undefined>(undefined);
  const lastRemoteUrlRef = useRef<string | undefined>(undefined);
  const isInitialMountRef = useRef(true);

  // Initialize immediately for drilldown panels
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Update iframe URL when panel becomes available or URL changes
  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    // Wait for panel to be available
    if (!panel) {
      return;
    }

    // Get the current URL from panel state
    const currentUrl = panel.mode === mode && panel.iframeUrl
      ? panel.iframeUrl
      : initialUrl;
    
    // On initial mount, set the URL immediately
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      if (currentUrl !== drilldownUrl) {
        setDrilldownUrl(currentUrl);
      }
      return;
    }
    
    // Skip if this is the same URL we already have
    if (currentUrl === drilldownUrl) {
      return;
    }
    
    // Skip if this is a local update we just made
    if (currentUrl === lastLocalUrlRef.current) {
      return;
    }
    
    // Skip if we already processed this remote URL
    if (currentUrl === lastRemoteUrlRef.current) {
      return;
    }
    
    // This is a new remote URL - update the iframe
    lastRemoteUrlRef.current = currentUrl;
    setDrilldownUrl(currentUrl);
  }, [panel?.iframeUrl, isInitialized, panel, drilldownUrl, mode, appPath, initialUrl]);

  // Auto-save iframe URL changes for drilldown panels
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
          // Mark this as a local update so we don't reload the iframe when the CRDT syncs back
          lastLocalUrlRef.current = currentUrl;
          // Clear the remote URL marker since we're updating locally
          lastRemoteUrlRef.current = undefined;
          dispatch(
            updatePanelIframeUrl({
              panelId,
              iframeUrl: currentUrl,
            })
          );
          // Clear the local URL marker after a delay to allow for remote updates
          setTimeout(() => {
            // Only clear if it's still the same URL (no new local navigation happened)
            if (lastLocalUrlRef.current === currentUrl) {
              lastLocalUrlRef.current = undefined;
            }
          }, 2000);
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
        src={drilldownUrl}
        title={t(titleKey, titleDefault)}
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

