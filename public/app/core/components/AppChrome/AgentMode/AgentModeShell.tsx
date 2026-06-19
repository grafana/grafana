import { css } from '@emotion/css';
import { type RefCallback } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { usePluginComponent } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

const AGENT_WORKSPACE_COMPONENT_ID = 'grafana-assistant-app/agent-mode-workspace/v1';

interface AgentWorkspaceProps {
  registerPlatformHost?: RefCallback<HTMLDivElement>;
  onExitAgentMode?: () => void;
}

interface Props {
  // The live page outlet is portaled into this node by AppChrome. The Platform tab
  // body just exposes it; the page itself stays mounted in AppChrome's React tree.
  outletRef: RefCallback<HTMLDivElement>;
}
export function AgentModeShell({ outletRef }: Props) {
  const { chrome } = useGrafana();
  const styles = useStyles2(getStyles);
  const { component: PluginWorkspace, isLoading } =
    usePluginComponent<AgentWorkspaceProps>(AGENT_WORKSPACE_COMPONENT_ID);

  if (!PluginWorkspace || isLoading) {
    return null;
  }

  return (
    <div className={styles.root}>
      <PluginWorkspace registerPlatformHost={outletRef} onExitAgentMode={() => chrome.setAgentMode(false)} />
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
  panes: css({
    display: 'flex',
    flexGrow: 1,
    minHeight: 0,
  }),
  chatStub: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    width: 360,
    padding: theme.spacing(2),
    borderRight: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.primary,
  }),
  canvas: css({
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    minWidth: 0,
  }),
  tabStrip: css({
    display: 'flex',
    gap: theme.spacing(2),
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.primary,
  }),
  tabDisabled: css({
    color: theme.colors.text.disabled,
  }),
  platformTabHost: css({
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    overflow: 'auto',
    minHeight: 0,
  }),
});
