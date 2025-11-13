import React from 'react';

import { t } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';

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
    case 'grafana-investigations-app':
      return 'eye';
    default:
      return 'ai-sparkle';
  }
}

function ExtensionToolbarItemButtonComponent(
  { isOpen, title, onClick, pluginId }: ToolbarItemButtonProps,
  ref: React.ForwardedRef<HTMLButtonElement>
) {
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

  return (
    <ToolbarButton
      ref={ref}
      icon={icon}
      iconOnly
      data-testid={`extension-toolbar-button-${isOpen ? 'close' : 'open'}`}
      variant={isOpen ? 'active' : 'default'}
      onClick={onClick}
      tooltip={tooltip}
    />
  );
}

// Wrapped the component with React.forwardRef to enable ref forwarding, which is required
// for proper integration with the Dropdown component from @grafana/ui
export const ExtensionToolbarItemButton = React.forwardRef<HTMLButtonElement, ToolbarItemButtonProps>(
  ExtensionToolbarItemButtonComponent
);
