import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useTranslate } from '@grafana/i18n';
import { ToolbarButton, useTheme2 } from '@grafana/ui';

interface ToolbarItemButtonProps {
  isOpen: boolean;
  title?: string;
  onClick?: () => void;
}

export function ExtensionToolbarItemButton({ isOpen, title, onClick }: ToolbarItemButtonProps) {
  const styles = getStyles(useTheme2());
  const { t } = useTranslate();

  if (isOpen) {
    // render button to close the sidebar
    return (
      <ToolbarButton
        className={cx(styles.button, styles.buttonActive)}
        icon="ai-sparkle"
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
      className={cx(styles.button)}
      icon="ai-sparkle"
      data-testid="extension-toolbar-button-open"
      variant="default"
      onClick={onClick}
      tooltip={tooltip}
    />
  );
}

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
