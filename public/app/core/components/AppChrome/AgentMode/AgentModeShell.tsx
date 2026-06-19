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
});
