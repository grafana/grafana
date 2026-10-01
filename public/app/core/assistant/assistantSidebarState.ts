import { ASSISTANT_PLUGIN_ID } from '@grafana/assistant';
import { store } from '@grafana/data';
import {
  EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY,
  getComponentMetaFromComponentId,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarUtils';
import { isFullscreenWorkspaceActive } from 'app/core/components/AppChrome/FullscreenWorkspace/fullscreenWorkspaceState';

// Active conversation id stored by the assistant app.
const ACTIVE_ASSISTANT_CHAT_ID_KEY = 'grafana-assistant-active-chat-id';

/**
 * Whether the assistant chat is on screen. Two ways for that to be true, and every entry point
 * needs both: docked in the extension sidebar, or in the fullscreen workspace — where the docked
 * sidebar is closed but the chat is the thing the user is looking at.
 *
 * Hook-free on purpose, so imperative code can use it: the sidebar half reads the same
 * localStorage key `useExtensionSidebarContext()` mirrors its state from, and the workspace half
 * reads the mirror `useFullscreenWorkspace()` publishes.
 */
function isAssistantVisible(): boolean {
  const dockedComponentId = store.get(EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY);
  const isDockedInSidebar = getComponentMetaFromComponentId(dockedComponentId ?? '')?.pluginId === ASSISTANT_PLUGIN_ID;

  return isDockedInSidebar || isFullscreenWorkspaceActive();
}

/**
 * The chat to append to when opening the assistant, or `undefined` to start a fresh one.
 *
 * Targeting the active chat is what makes an entry point land as a follow-up while the assistant
 * is on screen; without it the assistant app starts a new conversation over the one the user is
 * reading. When it isn't on screen, a new chat is what we want.
 */
export function getAssistantChatIdToContinue(): string | undefined {
  if (!isAssistantVisible()) {
    return undefined;
  }

  return store.get(ACTIVE_ASSISTANT_CHAT_ID_KEY) ?? undefined;
}
