import { css } from '@emotion/css';
import { forwardRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { MessageSparkles, Sparkles, Icon as SVGIcon } from '@grafana/icons';
import { ToolbarButton, useStyles2, useTheme2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

interface Props {
  /** Whether the assistant sidebar is open — drives the Chat pill's active styling. */
  isOpen: boolean;
  /** Toggles the assistant sidebar. */
  onClick?: () => void;
}

const ASSISTANT_ICON_GRADIENT_ID = 'grafana-assistant-toolbar-icon-gradient';

function getOrangeColor(theme: GrafanaTheme2) {
  return theme.visualization.getColorByName('orange');
}
function getPurpleColor(theme: GrafanaTheme2) {
  return theme.visualization.getColorByName('dark-purple');
}

function AssistantIconGradientDefs() {
  const theme = useTheme2();

  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden focusable="false">
      <defs>
        <linearGradient id={ASSISTANT_ICON_GRADIENT_ID} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor={getOrangeColor(theme)} />
          <stop offset="80%" stopColor={getPurpleColor(theme)} />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * The Grafana Assistant's top-bar buttons: a labelled purple "Chat" pill (the sidebar
 * toggle) and an "Enter Workspace" pill. `ExtensionToolbarItemButton` delegates here for
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
      <AssistantIconGradientDefs />
      <ToolbarButton
        ref={ref}
        icon={
          <span className={styles.chatIcon}>
            <SVGIcon component={Sparkles} size="lg" />
          </span>
        }
        onClick={onClick}
        variant={isOpen ? 'active' : 'default'}
        className={isOpen ? styles.chatButtonActive : undefined}
        data-testid={`extension-toolbar-button-${isOpen ? 'close' : 'open'}`}
        aria-expanded={isOpen}
        aria-pressed={isOpen}
        aria-label={
          isOpen
            ? t('navigation.extension-sidebar.assistant-close', 'Close Grafana Assistant')
            : t('navigation.extension-sidebar.assistant-open', 'Open Grafana Assistant')
        }
        tooltip={
          isOpen
            ? t('navigation.extension-sidebar.assistant-close-tooltip', 'Close Chat')
            : t('navigation.extension-sidebar.assistant-open-tooltip', 'Open Chat')
        }
      >
        {t('navigation.extension-sidebar.assistant-label', 'Chat')}
      </ToolbarButton>
      <NavToolbarSeparator />
      <ToolbarButton
        icon={
          <span className={styles.workspaceIcon}>
            <SVGIcon component={MessageSparkles} size="lg" />
          </span>
        }
        onClick={() => chrome.setFullscreenWorkspace(true)}
        aria-label={t('navigation.fullscreen-workspace.workspace', 'Workspace')}
        tooltip={t('navigation.fullscreen-workspace.enter', 'Enter Workspace')}
      >
        {t('navigation.fullscreen-workspace.workspace', 'Workspace')}
      </ToolbarButton>
      <NavToolbarSeparator className={styles.separator} />
    </>
  );
});

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
    margin: theme.spacing(0, 1, 0, 2),
    color: '#9b8cff',
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    '&:hover': {
      background: 'rgba(155, 140, 255, 0.12)',
    },
  }),
  assistantPillActive: css({
    borderColor: '#9b8cff',
    background: 'rgba(155, 140, 255, 0.12)',
    boxShadow: '0 0 0 1px rgba(155, 140, 255, 0.35)',
  }),
  separator: css({
    marginRight: theme.spacing(1),
  }),
  chatButtonActive: css({
    '&:hover, &:focus': {
      background: theme.colors.secondary.main,
      border: `1px solid ${theme.colors.secondary.border}`,
    },
  }),
  chatIcon: css({
    display: 'inline-flex',
    '& svg path': {
      fill: 'none',
      stroke: `url(#${ASSISTANT_ICON_GRADIENT_ID})`,
    },
  }),
  workspaceIcon: css({
    display: 'inline-flex',
    '& svg path:first-of-type': {
      fill: 'none',
      stroke: `url(#${ASSISTANT_ICON_GRADIENT_ID})`,
    },
    '& svg path:nth-of-type(2)': {
      fill: getPurpleColor(theme),
      stroke: 'none',
    },
  }),
});
