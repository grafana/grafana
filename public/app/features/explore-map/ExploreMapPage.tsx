import { css } from '@emotion/css';
import { useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom-v5-compat';
import { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { ErrorBoundaryAlert, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { ExploreMapCanvas } from './components/ExploreMapCanvas';
import { ExploreMapFloatingToolbar } from './components/ExploreMapFloatingToolbar';
import { ExploreMapToolbar } from './components/ExploreMapToolbar';
import { TransformProvider } from './context/TransformContext';
import { useCanvasPersistence } from './hooks/useCanvasPersistence';
import { useRealtimeSync } from './realtime/useRealtimeSync';

export default function ExploreMapPage(props: GrafanaRouteComponentProps<{ uid?: string }>) {
  const styles = useStyles2(getStyles);
  const { chrome } = useGrafana();
  const navModel = useNavModel('explore-map');
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const { uid } = useParams<{ uid?: string }>();

  // Initialize canvas persistence (with uid if available)
  const { loading } = useCanvasPersistence({ uid });

  // Stable callback references for realtime sync
  const handleConnected = useCallback(() => {
    // Connected to real-time sync
  }, []);

  const handleDisconnected = useCallback(() => {
    // Disconnected from real-time sync
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error('CRDT sync error:', error);
  }, []);

  // Enable real-time CRDT synchronization when uid is available
  useRealtimeSync({
    mapUid: uid || '',
    enabled: !!uid,
    onConnected: handleConnected,
    onDisconnected: handleDisconnected,
    onError: handleError,
  });

  useEffect(() => {
    chrome.update({
      sectionNav: navModel,
    });
  }, [chrome, navModel]);

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <p>Loading explore map...</p>
      </div>
    );
  }

  return (
    <ErrorBoundaryAlert>
      <TransformProvider value={{ transformRef }}>
        <div className={styles.pageWrapper}>
          <h1 className="sr-only">
            <Trans i18nKey="nav.explore-map.title">Explore Map</Trans>
          </h1>
          <ExploreMapToolbar uid={uid} />
          <ExploreMapCanvas />
          <ExploreMapFloatingToolbar />
        </div>
      </TransformProvider>
    </ErrorBoundaryAlert>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    pageWrapper: css({
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      backgroundColor: theme.colors.background.primary,
    }),
    loadingWrapper: css({
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background.primary,
    }),
  };
};
