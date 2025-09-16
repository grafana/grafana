import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ToolbarButton, useStyles2 } from '@grafana/ui';

interface ToolbarItemButtonProps {
  isOpen: boolean;
  title?: string;
  onClick?: () => void;
  pluginId?: string;
}

function getPluginIcon(pluginId?: string): string {
  switch (pluginId) {
    case 'grafana-grafanadocsplugin-app':
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
  const styles = useStyles2(getStyles);
  const icon = getPluginIcon(pluginId);

  if (isOpen) {
    // render button to close the sidebar
    return (
      <ToolbarButton
        ref={ref}
        className={cx(styles.button, styles.buttonActive)}
        icon={icon}
        data-testid="extension-toolbar-button-close"
        variant="default"
        onClick={onClick}
        tooltip={t('navigation.extension-sidebar.button-tooltip.close', 'Close {{title}}', { title })}
      />
    );
  }
  // if a title is provided, use it in the tooltip
  let tooltip = t('navigation.extension-sidebar.button-tooltip.open-all', 'Open AI assistants and sidebar apps');
  if (title) {
    tooltip = t('navigation.extension-sidebar.button-tooltip.open', 'Open {{title}}', { title });
  }
  return (
    <ToolbarButton
      ref={ref}
      className={cx(styles.button)}
      icon={icon}
      data-testid="extension-toolbar-button-open"
      variant="default"
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

function getStyles(theme: GrafanaTheme2) {
  return {
    button: css({
      // this is needed because with certain breakpoints the button will get `width: auto`
      // and the icon will stretch
      aspectRatio: '1 / 1 !important',
      width: '28px',
      height: '28px',
      padding: 0,
      justifyContent: 'center',
      borderRadius: theme.shape.radius.circle,
      margin: theme.spacing(0, 0.25),
    }),
    buttonActive: css({
      borderRadius: theme.shape.radius.circle,
      backgroundColor: theme.colors.primary.transparent,
      border: `1px solid ${theme.colors.primary.borderTransparent}`,
      color: theme.colors.text.primary,
    }),
  };
}
