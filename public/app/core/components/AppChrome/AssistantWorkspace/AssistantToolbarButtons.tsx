import { css, cx } from '@emotion/css';
import { useEffect, useRef } from 'react';

import { colorManipulator, type GrafanaTheme2 } from '@grafana/data';
import { useObservable } from '@grafana/data/unstable';
import { t } from '@grafana/i18n';
import { locationService, reportInteraction } from '@grafana/runtime';
import { useFlagAssistantFullscreenWorkspace } from '@grafana/runtime/internal';
import { Icon, ToolbarButton, useStyles2, useTheme2 } from '@grafana/ui';
import { getAssistantChatIdToContinue } from 'app/core/assistant/assistantSidebarState';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';

import { useExtensionSidebarContext } from '../ExtensionSidebar/ExtensionSidebarProvider';
import {
  getComponentIdFromComponentMeta,
  getComponentMetaFromComponentId,
} from '../ExtensionSidebar/extensionSidebarUtils';
import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

import {
  ASSISTANT_PLUGIN_ID,
  getPageBeforeWorkspace,
  isAssistantWorkspacePath,
  rememberPageBeforeWorkspace,
  workspaceUrlFor,
} from './assistantWorkspaceRoute';

const CHAT_ICON_GRADIENT_ID = 'grafana-assistant-chat-icon-gradient';
// The Assistant's brand orange, the colour Exit Workspace had in the fullscreen workspace.
const EXIT_WORKSPACE_ORANGE = '#FF8833';
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
 * The Grafana Assistant's top-bar buttons. Elsewhere they are a "Chat" pill (the sidebar toggle) and a
 * "Workspace" button that opens the Assistant Workspace page; on that page they are a single "Exit Workspace"
 * button back to the page the user came from. Self-contained like `NavRightButton`/`InviteUserButton`: it decides
 * for itself whether it should render (workspace flag on, not a small screen, and the assistant available).
 */
export function AssistantToolbarButtons() {
  const styles = useStyles2(getStyles);
  const workspaceEnabled = useFlagAssistantFullscreenWorkspace();
  const isSmallScreen = !useMediaQueryMinWidth('sm');
  const { availableComponents, dockedComponentId, setDockedComponentId, floatingHidden } = useExtensionSidebarContext();
  // The top bar also renders outside a router, so the location comes from the location service.
  const location = useObservable(locationService.getLocationObservable(), locationService.getLocation());
  const onWorkspace = isAssistantWorkspacePath(location.pathname);

  const assistantComponentTitle = availableComponents.get(ASSISTANT_PLUGIN_ID)?.addedComponents[0]?.title;
  const assistantComponentId = assistantComponentTitle
    ? getComponentIdFromComponentMeta(ASSISTANT_PLUGIN_ID, assistantComponentTitle)
    : undefined;
  // Held hidden, the sidebar reads as closed, so the button shows it instead of closing it unseen.
  const isOpen = assistantComponentId !== undefined && dockedComponentId === assistantComponentId && !floatingHidden;

  useRememberPageBeforeWorkspace(workspaceEnabled, location, onWorkspace);
  useCollapseMegaMenuOnWorkspace(workspaceEnabled && onWorkspace);

  // The plugin hides its sidebar entry on the workspace, so the assistant can be missing from
  // `availableComponents` there; the page itself shows the plugin is installed.
  const shouldRender = workspaceEnabled && !isSmallScreen && (onWorkspace || assistantComponentId !== undefined);
  if (!shouldRender) {
    return null;
  }

  if (onWorkspace) {
    return (
      <>
        <ToolbarButton
          icon="signout"
          className={styles.exitButton}
          onClick={() => {
            reportInteraction('grafana_assistant_workspace', { action: 'exit' });
            locationService.push(getPageBeforeWorkspace()?.url ?? '/');
          }}
          aria-label={t('navigation.assistant-workspace.exit', 'Exit Workspace')}
          tooltip={t('navigation.assistant-workspace.exit-tooltip', 'Return to the page you were on')}
        >
          {t('navigation.assistant-workspace.exit', 'Exit Workspace')}
        </ToolbarButton>
        <NavToolbarSeparator className={styles.separator} />
      </>
    );
  }

  return (
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
        className={cx(styles.button, isOpen && styles.chatButtonActive)}
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
        className={styles.button}
        onClick={() => {
          reportInteraction('grafana_assistant_workspace', { action: 'open' });
          // Continues the chat open in the sidebar, if any; the workspace closes the sidebar itself.
          locationService.push(workspaceUrlFor(getAssistantChatIdToContinue()));
        }}
        aria-label={t('navigation.assistant-workspace.open', 'Workspace')}
        tooltip={t('navigation.assistant-workspace.open-tooltip', 'Open Assistant Workspace')}
      >
        {t('navigation.assistant-workspace.open', 'Workspace')}
      </ToolbarButton>
      <NavToolbarSeparator className={styles.separator} />
    </>
  );
}

/**
 * Keeps the last page outside the workspace, and whether the assistant sidebar was open on it, for Exit Workspace.
 * However the user reaches the workspace (this button, the mega menu, search or a link), the page before it is
 * known. Leaving the workspace reopens the sidebar it closed.
 */
function useRememberPageBeforeWorkspace(
  enabled: boolean,
  location: { pathname: string; search: string; hash: string },
  onWorkspace: boolean
) {
  const { dockedComponentId, setDockedComponentId, floatingHidden } = useExtensionSidebarContext();
  const previousPathname = useRef(location.pathname);
  const { pathname, search, hash } = location;
  const assistantDocked =
    !floatingHidden && getComponentMetaFromComponentId(dockedComponentId ?? '')?.pluginId === ASSISTANT_PLUGIN_ID;

  useEffect(() => {
    const leftWorkspace = isAssistantWorkspacePath(previousPathname.current) && !onWorkspace;
    previousPathname.current = pathname;
    if (!enabled || onWorkspace) {
      return;
    }
    if (leftWorkspace) {
      const sidebarComponentId = getPageBeforeWorkspace()?.sidebarComponentId;
      if (sidebarComponentId && dockedComponentId === undefined) {
        // This effect runs again with the reopened sidebar and remembers it then.
        setDockedComponentId(sidebarComponentId);
        return;
      }
    }
    rememberPageBeforeWorkspace({ pathname, search, hash }, assistantDocked ? dockedComponentId : undefined);
  }, [enabled, onWorkspace, pathname, search, hash, assistantDocked, dockedComponentId, setDockedComponentId]);
}

/**
 * Closes the docked mega menu on the workspace, which needs the width, and reopens it on the way out if it was open
 * on the way in. Neither change is persisted, so the menu keeps the user's own preference everywhere else.
 */
function useCollapseMegaMenuOnWorkspace(collapse: boolean) {
  const { chrome } = useGrafana();
  const reopenOnExit = useRef(false);

  useEffect(() => {
    const { megaMenuDocked, megaMenuOpen } = chrome.state.getValue();
    if (collapse) {
      if (megaMenuDocked && megaMenuOpen) {
        reopenOnExit.current = true;
        chrome.setMegaMenuOpen(false, false);
      }
      return;
    }
    if (reopenOnExit.current) {
      reopenOnExit.current = false;
      if (megaMenuDocked && !megaMenuOpen) {
        chrome.setMegaMenuOpen(true, false);
      }
    }
  }, [chrome, collapse]);
}

const getStyles = (theme: GrafanaTheme2) => ({
  separator: css({
    marginRight: theme.spacing(1),
  }),
  button: css({
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeightRegular,
  }),
  exitButton: css({
    color: EXIT_WORKSPACE_ORANGE,
    border: `1px solid ${colorManipulator.alpha(EXIT_WORKSPACE_ORANGE, 0.4)}`,
    '&:hover:where(:not(:disabled))': {
      color: EXIT_WORKSPACE_ORANGE,
      background: colorManipulator.alpha(EXIT_WORKSPACE_ORANGE, 0.16),
    },
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
