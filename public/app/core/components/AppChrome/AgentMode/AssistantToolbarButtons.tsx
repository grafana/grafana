import { css, cx } from '@emotion/css';
import { forwardRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

interface Props {
  /** Whether the assistant sidebar is open — drives the Chat pill's active styling. */
  isOpen: boolean;
  /** Toggles the assistant sidebar. */
  onClick?: () => void;
}

/**
 * The Grafana Assistant's top-bar buttons: a labelled purple "Chat" pill (the sidebar
 * toggle) and an "Enter Agent mode" pill. `ExtensionToolbarItemButton` delegates here for
 * the `grafana-assistant-app` plugin, keeping the assistant-specific UI + styles out of the
 * generic extension-toolbar button. The forwarded ref lands on the Chat pill for the
 * extension sidebar's `Dropdown` integration.
 */
export const AssistantToolbarButtons = forwardRef<HTMLButtonElement, Props>(function AssistantToolbarButtons(
  { isOpen, onClick },
  ref
) {
  const styles = useStyles2(getStyles);
  const { chrome } = useGrafana();

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={cx(styles.assistantPill, isOpen && styles.assistantPillActive)}
        data-testid={`extension-toolbar-button-${isOpen ? 'close' : 'open'}`}
        aria-expanded={isOpen}
        aria-pressed={isOpen}
        aria-label={
          isOpen
            ? t('navigation.extension-sidebar.assistant-close', 'Close Grafana Assistant')
            : t('navigation.extension-sidebar.assistant-open', 'Open Grafana Assistant')
        }
        onClick={onClick}
      >
        <Icon name="ai-sparkle" size="md" />
        <span>{t('navigation.extension-sidebar.assistant-label', 'Chat')}</span>
      </button>
      <button
        type="button"
        className={styles.agentModeButton}
        onClick={() => chrome.setAgentMode(true)}
        aria-label={t('navigation.agent-mode.enter', 'Enter Agent mode')}
      >
        <span className={styles.agentModeIcon}>
          <Icon name="ai-sparkle" size="md" />
        </span>
        <span className={styles.agentModeText}>{t('navigation.agent-mode.enter', 'Enter Agent mode')}</span>
      </button>
    </>
  );
});

// Purple "Ask assistant" pill (from the workspace prototype), matching the agent-mode
// button shape; applied to the assistant toolbar buttons only.
const getStyles = (theme: GrafanaTheme2) => ({
  assistantPill: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    height: theme.spacing(3.5),
    padding: theme.spacing(0, 1.25),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    background: 'rgba(155, 140, 255, 0.05)',
    margin: theme.spacing(0, 2),
    color: '#9b8cff',
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    '&:hover': {
      background: 'rgba(155, 140, 255, 0.12)',
    },
  }),
  // Active (sidebar open): accent purple border + soft ring.
  assistantPillActive: css({
    borderColor: '#9b8cff',
    background: 'rgba(155, 140, 255, 0.12)',
    boxShadow: '0 0 0 1px rgba(155, 140, 255, 0.35)',
  }),
  // Agent-mode entry button, adapted from the workspace prototype: a compact bordered
  // pill with a gradient label.
  agentModeButton: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    height: theme.spacing(3.5),
    marginRight: theme.spacing(2),
    padding: theme.spacing(0, 1.25),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    background: 'transparent',
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  agentModeIcon: css({
    display: 'inline-flex',
    color: '#ff8a2b',
  }),
  agentModeText: css({
    background: 'linear-gradient(90deg, #ff8a2b, #f2546b, #e07be0, #9b8cff)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  }),
});
