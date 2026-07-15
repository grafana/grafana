import { css } from '@emotion/css';
import { type RefCallback } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { usePluginComponent } from '@grafana/runtime';
import { Button, EmptyState, ErrorBoundary, PageLoader, Stack, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

const FULLSCREEN_WORKSPACE_COMPONENT_ID = 'grafana-assistant-app/fullscreen-workspace/v1';

interface FullscreenWorkspaceComponentProps {
  workspaceHostRef?: RefCallback<HTMLDivElement>;
  onExitFullscreenWorkspace?: () => void;
}

interface Props {
  // The live page outlet is portaled into this node by AppChrome. The Platform tab
  // body just exposes it; the page itself stays mounted in AppChrome's React tree.
  workspaceHostRef: RefCallback<HTMLDivElement>;
}
export function FullscreenWorkspaceShell({ workspaceHostRef }: Props) {
  const { chrome } = useGrafana();
  const styles = useStyles2(getStyles);
  const { component: PluginWorkspace, isLoading } = usePluginComponent<FullscreenWorkspaceComponentProps>(
    FULLSCREEN_WORKSPACE_COMPONENT_ID
  );

  if (isLoading) {
    return (
      <div className={styles.root}>
        <PageLoader />
      </div>
    );
  }

  const exitWorkspace = () => chrome.setFullscreenWorkspace(false);

  // No component once loading has finished means the plugin isn't available (not installed,
  // disabled, or failed to load). Show a minimal error rather than a blank page.
  if (!PluginWorkspace) {
    return (
      <div className={styles.root}>
        <WorkspaceError onExit={exitWorkspace} />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <ErrorBoundary boundaryName="fullscreen-workspace">
        {({ error }) =>
          // A crash inside the plugin workspace is contained here so it can't take down the
          // whole app; fall back to the same minimal error message.
          error ? (
            <WorkspaceError onExit={exitWorkspace} />
          ) : (
            <PluginWorkspace workspaceHostRef={workspaceHostRef} onExitFullscreenWorkspace={exitWorkspace} />
          )
        }
      </ErrorBoundary>
    </div>
  );
}

// `onExit` leaves workspace mode without a reload: AppChrome reparents the still-mounted live page
// back into <main>, which always works since normal Grafana doesn't depend on the plugin. Reload is
// offered as a secondary fallback.
function WorkspaceError({ onExit }: { onExit: () => void }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.message}>
      <EmptyState
        variant="not-found"
        role="alert"
        message={t('navigation.fullscreen-workspace.error-title', 'Workspace unavailable')}
        button={
          <Stack direction="row" gap={2}>
            <Button onClick={onExit}>{t('navigation.fullscreen-workspace.error-exit', 'Exit workspace')}</Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              {t('navigation.fullscreen-workspace.error-reload', 'Reload page')}
            </Button>
          </Stack>
        }
      >
        {t('navigation.fullscreen-workspace.error-message', 'The Grafana Assistant workspace could not be loaded.')}
      </EmptyState>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  root: css({
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: theme.colors.background.canvas,
  }),
  message: css({
    display: 'flex',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(2),
  }),
});
