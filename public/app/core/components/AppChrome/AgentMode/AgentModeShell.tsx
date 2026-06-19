import { css } from '@emotion/css';
import { type RefCallback } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { locationService, usePluginComponent } from '@grafana/runtime';
import { ToolbarButton, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

// The assistant plugin exposes the real workspace (chat + canvas + Platform tab) and
// hands its Platform-tab DOM node back to us via `registerPlatformHost` so we can
// portal the live page into it. Until the plugin loads, we fall back to a local stub.
const AGENT_WORKSPACE_COMPONENT_ID = 'grafana-assistant-app/agent-mode-workspace/v1';

interface AgentWorkspaceProps {
  registerPlatformHost?: RefCallback<HTMLDivElement>;
  // The plugin renders its own "Back to platform" button (in the workspace header) and
  // calls this to exit agent mode — so we don't render a separate agent-mode top bar.
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

  return (
    <div className={styles.root}>
      {PluginWorkspace ? (
        <PluginWorkspace registerPlatformHost={outletRef} onExitAgentMode={() => chrome.setAgentMode(false)} />
      ) : (
        <div className={styles.panes}>
          <aside className={styles.chatStub}>
            <ToolbarButton icon="arrow-left" onClick={() => chrome.setAgentMode(false)}>
              Back to platform
            </ToolbarButton>
            <div>{isLoading ? 'loading assistant…' : 'assistant plugin unavailable'}</div>
            {/* Fallback stub — also proves locationService drives the portaled outlet. */}
            <ToolbarButton onClick={() => locationService.push('/dashboards')}>→ dashboards</ToolbarButton>
            <ToolbarButton onClick={() => locationService.push('/explore')}>→ explore</ToolbarButton>
          </aside>
          <section className={styles.canvas}>
            <div className={styles.tabStrip}>
              <span>Platform</span>
              <span className={styles.tabDisabled}>Chart</span>
              <span className={styles.tabDisabled}>Hypothesis</span>
              <span className={styles.tabDisabled}>Report</span>
            </div>
            <div className={styles.platformTabHost} ref={outletRef} />
          </section>
        </div>
      )}
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
