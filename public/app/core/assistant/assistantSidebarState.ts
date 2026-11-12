import { ASSISTANT_PLUGIN_ID } from '@grafana/assistant';
import { store } from '@grafana/data';
import {
  EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY,
  getComponentMetaFromComponentId,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarUtils';

// Active conversation id stored by the assistant app.
const ACTIVE_ASSISTANT_CHAT_ID_KEY = 'grafana-assistant-active-chat-id';

/**
 * Whether the assistant chat is docked in the extension sidebar.
 *
 * Hook-free on purpose, so imperative code can use it: it reads the same localStorage key
 * `useExtensionSidebarContext()` mirrors its state from.
 */
function isAssistantVisible(): boolean {
  const dockedComponentId = store.get(EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY);
  return getComponentMetaFromComponentId(dockedComponentId ?? '')?.pluginId === ASSISTANT_PLUGIN_ID;
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
