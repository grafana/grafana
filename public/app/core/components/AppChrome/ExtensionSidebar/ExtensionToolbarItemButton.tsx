import { css, cx } from '@emotion/css';
import React from 'react';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, ToolbarButton, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

interface ToolbarItemButtonProps {
  isOpen: boolean;
  title?: string;
  onClick?: () => void;
  pluginId?: string;
}

function getPluginIcon(pluginId?: string): IconName {
  switch (pluginId) {
    // The docs plugin ID is transitioning from grafana-grafanadocsplugin-app to grafana-pathfinder-app.
    // Support both until that migration is complete.
    case 'grafana-grafanadocsplugin-app':
    case 'grafana-pathfinder-app':
      return 'book';
    case 'grafana-grotfood-app':
      return 'gf-grotfood';
    default:
      return 'ai-sparkle';
  }
}

function ExtensionToolbarItemButtonComponent(
  { isOpen, title, onClick, pluginId }: ToolbarItemButtonProps,
  ref: React.ForwardedRef<HTMLButtonElement>
) {
  const styles = useStyles2(getStyles);
  const { chrome } = useGrafana();
  const icon = getPluginIcon(pluginId);
  const tooltip = (() => {
    if (isOpen) {
      return t('navigation.extension-sidebar.button-tooltip.close', 'Close {{title}}', { title });
    }
    if (title) {
      return t('navigation.extension-sidebar.button-tooltip.open', 'Open {{title}}', { title });
    }
    return t('navigation.extension-sidebar.button-tooltip.open-all', 'Open AI assistants and sidebar apps');
  })();

  // The assistant gets a labelled purple "Chat" pill (matching the agent-mode button
  // shape) with an accent border when the sidebar is open; other extension apps keep the
  // icon-only toolbar button. The "Enter Agent mode" entry lives here too — co-located with
  // Chat and intrinsically gated on the assistant plugin (agent mode renders the plugin's
  // exposed workspace, so it's a dead stub without the plugin).
  if (pluginId === 'grafana-assistant-app') {
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
          <Icon name={icon} size="md" />
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
  }

  return (
    <ToolbarButton
      ref={ref}
      icon={icon}
      iconOnly
      data-testid={`extension-toolbar-button-${isOpen ? 'close' : 'open'}`}
      variant={isOpen ? 'active' : 'default'}
      aria-expanded={isOpen}
      onClick={onClick}
      tooltip={tooltip}
      aria-pressed={isOpen}
    />
  );
}

// Wrapped the component with React.forwardRef to enable ref forwarding, which is required
// for proper integration with the Dropdown component from @grafana/ui
export const ExtensionToolbarItemButton = React.forwardRef<HTMLButtonElement, ToolbarItemButtonProps>(
  ExtensionToolbarItemButtonComponent
);

// Purple "Ask assistant" pill (from the workspace prototype), matching the agent-mode
// button shape; applied to the assistant toolbar button only.
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
    marginLeft: theme.spacing(2),
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
    margin: `0 ${theme.spacing(2)} 0 ${theme.spacing(1)}`,
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
