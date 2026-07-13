import { css } from '@emotion/css';
import { type RefCallback } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { usePluginComponent } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
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

  if (!PluginWorkspace || isLoading) {
    return null;
  }

  return (
    <div className={styles.root}>
      <PluginWorkspace
        workspaceHostRef={workspaceHostRef}
        onExitFullscreenWorkspace={() => chrome.setFullscreenWorkspace(false)}
      />
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
});
