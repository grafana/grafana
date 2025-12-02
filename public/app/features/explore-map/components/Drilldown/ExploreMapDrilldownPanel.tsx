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
  // Add kiosk parameter to hide chrome (including breadcrumbs) in the iframe
  const initialUrl = (() => {
    const origin = window.location.origin;
    const subUrl = config.appSubUrl || '';
    const baseUrl = `${origin}${subUrl}${appPath}`;
    // Add kiosk parameter to hide chrome/breadcrumbs (kiosk=1 enables full kiosk mode)
    const url = new URL(baseUrl, window.location.href);
    url.searchParams.set('kiosk', '1');
    return url.toString();
  })();

  const [drilldownUrl, setDrilldownUrl] = useState(initialUrl);
  const lastLocalUrlRef = useRef<string | undefined>(undefined);
  const lastRemoteUrlRef = useRef<string | undefined>(undefined);
  const isInitialMountRef = useRef(true);
  const hasSetInitialUrlRef = useRef(false);
  const lastPanelIframeUrlRef = useRef<string | undefined>(undefined);
  const lastAppliedRemoteUrlRef = useRef<string | undefined>(undefined);
  const remoteUrlAppliedTimeRef = useRef<number>(0);

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
    const panelIframeUrl = panel.mode === mode ? panel.iframeUrl : undefined;
    
    // Skip if panel iframeUrl hasn't actually changed (prevents unnecessary refreshes)
    if (panelIframeUrl === lastPanelIframeUrlRef.current && !isInitialMountRef.current) {
      return;
    }
    
    lastPanelIframeUrlRef.current = panelIframeUrl;
    
    let currentUrl = panelIframeUrl || initialUrl;
    
    // Ensure kiosk parameter is present to hide breadcrumbs
    try {
      const url = new URL(currentUrl, window.location.href);
      if (!url.searchParams.has('kiosk')) {
        url.searchParams.set('kiosk', '1');
        currentUrl = url.toString();
      }
    } catch (e) {
      // If URL parsing fails, use the original URL
      console.warn('Failed to parse URL for kiosk mode:', e);
    }
    
    // On initial mount, set the URL immediately (only once)
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      if (!hasSetInitialUrlRef.current) {
        hasSetInitialUrlRef.current = true;
        // Only update if URL is different from initial
        if (currentUrl !== initialUrl) {
          setDrilldownUrl(currentUrl);
        }
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
    lastAppliedRemoteUrlRef.current = currentUrl;
    remoteUrlAppliedTimeRef.current = Date.now();
    setDrilldownUrl(currentUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel?.iframeUrl, isInitialized]);

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
          // Skip if this URL was just applied from a remote update (within last 3 seconds)
          // This prevents the refresh loop where remote updates trigger saves that sync back
          const timeSinceRemoteUpdate = Date.now() - remoteUrlAppliedTimeRef.current;
          if (
            lastAppliedRemoteUrlRef.current &&
            currentUrl === lastAppliedRemoteUrlRef.current &&
            timeSinceRemoteUpdate < 3000
          ) {
            // This is the URL we just applied from remote - don't save it back
            lastSavedUrl = currentUrl;
            return;
          }
          
          // Ensure kiosk parameter is present in the saved URL
          let urlToSave = currentUrl;
          try {
            const url = new URL(currentUrl, window.location.href);
            if (!url.searchParams.has('kiosk')) {
              url.searchParams.set('kiosk', '1');
              urlToSave = url.toString();
            }
          } catch (e) {
            // If URL parsing fails, use the original URL
            console.warn('Failed to parse URL for kiosk mode:', e);
          }
          
          lastSavedUrl = urlToSave;
          // Mark this as a local update so we don't reload the iframe when the CRDT syncs back
          lastLocalUrlRef.current = urlToSave;
          // Clear the remote URL marker since we're updating locally
          lastRemoteUrlRef.current = undefined;
          lastAppliedRemoteUrlRef.current = undefined;
          dispatch(
            updatePanelIframeUrl({
              panelId,
              iframeUrl: urlToSave,
            })
          );
          // Clear the local URL marker after a delay to allow for remote updates
          setTimeout(() => {
            // Only clear if it's still the same URL (no new local navigation happened)
            if (lastLocalUrlRef.current === urlToSave) {
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

