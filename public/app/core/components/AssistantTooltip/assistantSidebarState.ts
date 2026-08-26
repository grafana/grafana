import { ASSISTANT_PLUGIN_ID } from '@grafana/assistant';
import { store } from '@grafana/data';
import {
  EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY,
  getComponentMetaFromComponentId,
} from 'app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider';

// Active conversation id stored by the assistant app.
const ACTIVE_ASSISTANT_CHAT_ID_KEY = 'grafana-assistant-active-chat-id';

export function getActiveAssistantChatId(): string | undefined {
  return store.get(ACTIVE_ASSISTANT_CHAT_ID_KEY) ?? undefined;
}

/**
 * Whether the assistant is currently docked open in the extension sidebar. Reads directly from
 * localStorage (the same source `useExtensionSidebarContext()` mirrors its state from) so it's
 * usable from imperative, non-component code where hooks aren't available.
 *
 * Callers that already have `useExtensionSidebarContext()` in scope should keep using that
 * instead — this exists for the cases that don't.
 */
export function isAssistantSidebarOpen(): boolean {
  const dockedComponentId = store.get(EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY);
  return getComponentMetaFromComponentId(dockedComponentId ?? '')?.pluginId === ASSISTANT_PLUGIN_ID;
}
