import { css } from '@emotion/css';
import { useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom-v5-compat';
import { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';

import { providePageContext, createAssistantContextItem } from '@grafana/assistant';
import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { ErrorBoundaryAlert, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { AddPanelAction, DebugAssistantContext } from './components/AssistantComponents';
import { ExploreMapCanvas } from './components/ExploreMapCanvas';
import { ExploreMapFloatingToolbar } from './components/ExploreMapFloatingToolbar';
import { ExploreMapToolbar } from './components/ExploreMapToolbar';
import { TransformProvider } from './context/TransformContext';
import { useCanvasPersistence } from './hooks/useCanvasPersistence';
import { useRealtimeSync } from './realtime/useRealtimeSync';

// Register custom components for the Grafana Assistant using providePageContext
// This ensures the component context is properly sent to the assistant
providePageContext(/.*/, [
  createAssistantContextItem('component', {
    components: {
      AddPanelAction,
    },
    namespace: 'exploreMap',
    prompt: `You have access to an interactive component that helps users add panels to the explore map canvas with pre-configured datasources and queries.

Component name: exploreMap_AddPanelAction

Whitelisted props:
- type: string - MUST ALWAYS BE "explore" (only explore panels are supported currently)
- description: string (optional custom button label)
- name: string (optional display name)
- namespace: string (optional datasource UID - use this to specify which datasource the panel should use)
- metric: string (optional query expression - PromQL for metrics, LogQL for logs, TraceQL for traces, etc.)
  IMPORTANT: Query must be URL-encoded to handle special characters like parentheses, quotes, braces, etc.

Usage examples (place directly in response, NEVER in code blocks):
<exploreMap_AddPanelAction type="explore" />
<exploreMap_AddPanelAction type="explore" namespace="prometheus-uid" metric="up" />
<exploreMap_AddPanelAction type="explore" namespace="loki-uid" metric="%7Bjob%3D%22varlogs%22%7D" />
<exploreMap_AddPanelAction type="explore" namespace="prometheus-uid" metric="rate%28http_requests_total%5B5m%5D%29" description="HTTP Request Rate" />
<exploreMap_AddPanelAction type="explore" namespace="prometheus-uid" metric="histogram_quantile%280.95%2C%20sum%28rate%28http_request_duration_seconds_bucket%5B5m%5D%29%29%20by%20%28le%29%29" description="P95 Latency" />

CRITICAL RULES:
- Components must NEVER be wrapped in code blocks (no backticks or \`\`\`).
- **ALWAYS set type="explore"** - this is the only supported panel type currently.
- Use namespace prop to specify datasource UID when you know which datasource to use.
- Use metric prop to provide initial query expressions.
- **ALWAYS URL-encode the metric prop value** to handle special characters: ( ) [ ] { } " ' = < > etc.
  Examples:
  - '{job="varlogs"}' becomes '%7Bjob%3D%22varlogs%22%7D'
  - 'rate(http_requests[5m])' becomes 'rate%28http_requests%5B5m%5D%29'
- Place components directly in your response text, not in code blocks.
- When users ask to add panels with specific queries, provide the component with namespace and URL-encoded metric props.
- You can provide multiple components in a single response for adding multiple panels.`,
  }),
]);

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
        <p>
          <Trans i18nKey="explore-map.loading">Loading explore map...</Trans>
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundaryAlert>
      <TransformProvider value={{ transformRef }}>
        <div className={styles.pageWrapper}>
          <DebugAssistantContext />
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
