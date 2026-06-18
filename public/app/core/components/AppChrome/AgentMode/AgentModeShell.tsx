// PoC stub UI — copy here is throwaway and replaced by the real assistant plugin
// surfaces in Phase 2, so it intentionally skips i18n.
/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { css } from '@emotion/css';
import { type RefCallback } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { locationService, usePluginComponent } from '@grafana/runtime';
import { ToolbarButton, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { MegaMenu, MENU_WIDTH } from '../MegaMenu/MegaMenu';
import { TopSearchBarCommandPaletteTrigger } from '../TopBar/TopSearchBarCommandPaletteTrigger';
import { getChromeHeaderLevelHeight } from '../TopBar/useChromeHeaderHeight';

// The assistant plugin exposes the real workspace (chat + canvas + Platform tab) and
// hands its Platform-tab DOM node back to us via `registerPlatformHost` so we can
// portal the live page into it. Until the plugin loads, we fall back to a local stub.
const AGENT_WORKSPACE_COMPONENT_ID = 'grafana-assistant-app/agent-mode-workspace/v1';

interface AgentWorkspaceProps {
  registerPlatformHost?: RefCallback<HTMLDivElement>;
}

interface Props {
  // The live page outlet is portaled into this node by AppChrome. The Platform tab
  // body just exposes it; the page itself stays mounted in AppChrome's React tree.
  outletRef: RefCallback<HTMLDivElement>;
}

/**
 * Phase 1 PoC shell for "agent mode": a fullscreen `conv list | chat | canvas`
 * layout that wraps the live Grafana page (rendered into the Platform tab via a
 * portal owned by AppChrome). Chat/canvas content here is a stub — Phase 2 swaps it
 * for the real assistant plugin surfaces. Kept in a dedicated file to minimize the
 * diff in AppChrome.tsx. See internal/docs/agentic-mode-poc.md (assistant repo).
 */
export function AgentModeShell({ outletRef }: Props) {
  const { chrome } = useGrafana();
  const styles = useStyles2(getStyles);
  const state = chrome.useState();
  const { component: PluginWorkspace, isLoading } = usePluginComponent<AgentWorkspaceProps>(
    AGENT_WORKSPACE_COMPONENT_ID
  );

  const closeMenu = () => chrome.setMegaMenuOpen(false);

  return (
    <div className={styles.root}>
      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <ToolbarButton
            narrow
            icon="bars"
            tooltip="Open menu"
            onClick={() => chrome.setMegaMenuOpen(!state.megaMenuOpen)}
            aria-expanded={state.megaMenuOpen}
          />
          <ToolbarButton icon="arrow-left" onClick={() => chrome.setAgentMode(false)}>
            Back to platform
          </ToolbarButton>
        </div>
        <TopSearchBarCommandPaletteTrigger />
      </header>
      {state.megaMenuOpen && (
        <>
          <div className={styles.menuBackdrop} onClick={closeMenu} role="presentation" />
          <nav className={styles.menuDrawer} aria-label="Navigation">
            <MegaMenu onClose={closeMenu} />
          </nav>
        </>
      )}
      {PluginWorkspace ? (
        <PluginWorkspace registerPlatformHost={outletRef} />
      ) : (
        <div className={styles.panes}>
          <aside className={styles.chatStub}>
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
  topBar: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    padding: theme.spacing(0, 1),
    height: getChromeHeaderLevelHeight(),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.primary,
  }),
  topBarLeft: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  }),
  menuBackdrop: css({
    position: 'fixed',
    inset: 0,
    zIndex: theme.zIndex.modalBackdrop,
    background: theme.components.overlay.background,
  }),
  menuDrawer: css({
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    width: MENU_WIDTH,
    zIndex: theme.zIndex.modal,
    display: 'flex',
    flexDirection: 'column',
    background: theme.colors.background.primary,
    borderRight: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z3,
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
