import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useFlagAssistantFullscreenWorkspace } from '@grafana/runtime/internal';
import { Icon, ToolbarButton, useStyles2, useTheme2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';

import {
  getComponentIdFromComponentMeta,
  useExtensionSidebarContext,
} from '../ExtensionSidebar/ExtensionSidebarProvider';
import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

const ASSISTANT_PLUGIN_ID = 'grafana-assistant-app';
const CHAT_ICON_GRADIENT_ID = 'grafana-assistant-chat-icon-gradient';
const WORKSPACE_ICON_GRADIENT_ID = 'grafana-assistant-workspace-icon-gradient';

function getOrangeColor(theme: GrafanaTheme2) {
  return theme.visualization.getColorByName('orange');
}
function getPurpleColor(theme: GrafanaTheme2) {
  return theme.visualization.getColorByName('dark-purple');
}

function AssistantIconGradientDefs() {
  const theme = useTheme2();
  const orange = getOrangeColor(theme);
  const purple = getPurpleColor(theme);

  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden focusable="false">
      <defs>
        <linearGradient id={CHAT_ICON_GRADIENT_ID} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor={orange} />
          <stop offset="80%" stopColor={purple} />
        </linearGradient>
        <linearGradient id={WORKSPACE_ICON_GRADIENT_ID} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor={orange} />
          <stop offset="80%" stopColor={purple} />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * The Grafana Assistant's top-bar buttons: a "Chat" pill (the sidebar toggle) and a
 * "Workspace" pill. Self-contained like `NavRightButton`/`InviteUserButton`: it decides for
 * itself whether it should render (fullscreen workspace flag on, not a small screen, and the
 * `grafana-assistant-app` plugin actually available), rather than the caller working that out.
 */
export function AssistantToolbarButtons() {
  const styles = useStyles2(getStyles);
  const { chrome } = useGrafana();
  const fullscreenWorkspaceEnabled = useFlagAssistantFullscreenWorkspace();
  const isSmallScreen = !useMediaQueryMinWidth('sm');
  const { availableComponents, dockedComponentId, setDockedComponentId } = useExtensionSidebarContext();

  const assistantComponentTitle = availableComponents.get(ASSISTANT_PLUGIN_ID)?.addedComponents[0]?.title;
  const assistantComponentId = assistantComponentTitle
    ? getComponentIdFromComponentMeta(ASSISTANT_PLUGIN_ID, assistantComponentTitle)
    : undefined;
  const isOpen = assistantComponentId !== undefined && dockedComponentId === assistantComponentId;

  const shouldRender = fullscreenWorkspaceEnabled && !isSmallScreen && assistantComponentId !== undefined;

  return (
    shouldRender && (
      <>
        <AssistantIconGradientDefs />
        <ToolbarButton
          icon={
            <span className={styles.chatIcon}>
              <Icon name="ai-sparkle" size="lg" />
            </span>
          }
          onClick={() => setDockedComponentId(isOpen ? undefined : assistantComponentId)}
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
              <Icon name="message-sparkles" size="lg" />
            </span>
          }
          onClick={() => chrome.setFullscreenWorkspace({ fullscreenWorkspace: true })}
          aria-label={t('navigation.fullscreen-workspace.workspace', 'Workspace')}
          tooltip={t('navigation.fullscreen-workspace.enter', 'Enter Workspace')}
        >
          {t('navigation.fullscreen-workspace.workspace', 'Workspace')}
        </ToolbarButton>
        <NavToolbarSeparator className={styles.separator} />
      </>
    )
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
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
      fill: `url(#${CHAT_ICON_GRADIENT_ID})`,
      stroke: `url(#${CHAT_ICON_GRADIENT_ID})`,
    },
  }),
  workspaceIcon: css({
    display: 'inline-flex',
    '& svg path:first-of-type': {
      fill: 'none',
      stroke: `url(#${WORKSPACE_ICON_GRADIENT_ID})`,
    },
    '& svg path:not(:first-of-type)': {
      fill: getPurpleColor(theme),
      stroke: 'none',
    },
  }),
});
