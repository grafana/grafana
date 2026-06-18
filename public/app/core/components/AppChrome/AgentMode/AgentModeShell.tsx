// PoC stub UI — copy here is throwaway and replaced by the real assistant plugin
// surfaces in Phase 2, so it intentionally skips i18n.
/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { css } from '@emotion/css';
import { type RefCallback } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { ToolbarButton, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { TopSearchBarCommandPaletteTrigger } from '../TopBar/TopSearchBarCommandPaletteTrigger';
import { getChromeHeaderLevelHeight } from '../TopBar/useChromeHeaderHeight';

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

  return (
    <div className={styles.root}>
      <header className={styles.topBar}>
        <ToolbarButton icon="arrow-left" onClick={() => chrome.setAgentMode(false)}>
          Back to platform
        </ToolbarButton>
        <TopSearchBarCommandPaletteTrigger />
      </header>
      <div className={styles.panes}>
        <aside className={styles.chatStub}>
          <div>chat goes here</div>
          {/* Prove that locationService drives the portaled outlet in place. */}
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
