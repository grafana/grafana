import { css } from '@emotion/css';
import { type MouseEvent, type RefCallback, useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { usePluginComponent } from '@grafana/runtime';
import { Button, EmptyState, ErrorBoundary, PageLoader, Stack, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useSelector } from 'app/types/store';

import { ProfileButton } from '../TopBar/ProfileButton';

const FULLSCREEN_WORKSPACE_COMPONENT_ID = 'grafana-assistant-app/fullscreen-workspace/v1';

interface FullscreenWorkspaceComponentProps {
  workspaceHostRef?: RefCallback<HTMLDivElement>;
  onExitFullscreenWorkspace?: () => void;
  topBarActionsRef?: RefCallback<HTMLDivElement>;
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
  // The workspace replaces the top bar, so the profile menu is portaled into a slot the plugin
  // header exposes. Building it here rather than in the plugin keeps one implementation of the
  // profile nav, theme/news drawers and sign-out; the plugin only decides where it sits.
  //
  // It has to be a portal, not a `ReactNode` prop: `wrapWithPluginContext` runs every prop through
  // `writableProxy`, which deep-clones it and proxies recursively — a React element's `_owner` fiber
  // graph is cyclic, so that recurses until the stack blows. Function props are passed through
  // untouched, so a ref callback crosses the boundary safely.
  const [topBarActions, setTopBarActions] = useState<HTMLElement | null>(null);
  const profileNode = useSelector((state) => state.navIndex['profile']);

  const exitWorkspace = useCallback(() => chrome.setFullscreenWorkspace({ fullscreenWorkspace: false }), [chrome]);

  // Everything portaled below targets normal Grafana pages, so a link click has to leave workspace
  // mode first or the destination opens inside the Platform tab. React events bubble along the React
  // tree through portals, so one capture handler here covers the whole portaled subtree — including
  // grafana-ui's own Dropdown portal — without shared chrome components knowing about the overlay.
  // Non-link items (theme, kiosk, news) are buttons that open drawers in place, so they don't match.
  const exitWorkspaceOnLinkClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const link = target.closest('a[href]');
      if (link && link.getAttribute('target') !== '_blank') {
        exitWorkspace();
      }
    },
    [exitWorkspace]
  );

  // Memoized so the slot ref firing during mount — a `setState` on this component — doesn't re-render
  // the whole plugin workspace subtree it just mounted. `writableProxy` clones the props on every
  // wrapper render, so no downstream memo can absorb that.
  const workspace = useMemo(
    () =>
      PluginWorkspace ? (
        <PluginWorkspace
          workspaceHostRef={workspaceHostRef}
          onExitFullscreenWorkspace={exitWorkspace}
          // Only claim the slot when there's something to put in it, so the plugin doesn't draw its
          // leading divider against an empty slot.
          topBarActionsRef={profileNode ? setTopBarActions : undefined}
        />
      ) : null,
    [PluginWorkspace, workspaceHostRef, exitWorkspace, profileNode]
  );

  if (isLoading) {
    return (
      <div className={styles.root}>
        <PageLoader />
      </div>
    );
  }

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
            <>
              {workspace}
              {topBarActions &&
                profileNode &&
                createPortal(
                  // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
                  <div onClickCapture={exitWorkspaceOnLinkClick}>
                    <ProfileButton profileNode={profileNode} onToggleKioskMode={chrome.onToggleKioskMode} />
                  </div>,
                  topBarActions
                )}
            </>
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
