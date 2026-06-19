import { css, cx } from '@emotion/css';
import React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, ToolbarButton, useStyles2 } from '@grafana/ui';

interface ToolbarItemButtonProps {
  isOpen: boolean;
  title?: string;
  onClick?: () => void;
  pluginId?: string;
}

function getPluginIcon(pluginId?: string): string {
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
  // icon-only toolbar button.
  if (pluginId === 'grafana-assistant-app') {
    return (
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
});
