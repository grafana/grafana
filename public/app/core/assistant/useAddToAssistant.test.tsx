import { renderHook } from '@testing-library/react';

import { createAssistantContextItem, useAssistant } from '@grafana/assistant';
import { store } from '@grafana/data';
import {
  EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY,
  getComponentIdFromComponentMeta,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarUtils';
import { setFullscreenWorkspaceActive } from 'app/core/components/AppChrome/FullscreenWorkspace/fullscreenWorkspaceState';

import { useAddToAssistant } from './useAddToAssistant';

jest.mock('@grafana/assistant', () => ({
  ASSISTANT_PLUGIN_ID: 'grafana-assistant-app',
  createAssistantContextItem: jest.fn((type, params) => ({ type, params })),
  useAssistant: jest.fn(),
}));

const openAssistant = jest.fn();
const context = [
  createAssistantContextItem('structured', { title: 'First', data: { value: 1 } }),
  createAssistantContextItem('structured', { title: 'Second', data: { value: 2 } }),
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAssistant).mockReturnValue({
    isAvailable: true,
    isLoading: false,
    openAssistant,
    closeAssistant: undefined,
    toggleAssistant: undefined,
  });
});

afterEach(() => {
  store.delete(EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY);
  store.delete('grafana-assistant-active-chat-id');
  setFullscreenWorkspaceActive(false);
});

it.each([
  ['closed', undefined, false, undefined],
  ['sidebar', 'grafana-assistant-app', false, 'active-chat'],
  ['fullscreen', undefined, true, 'active-chat'],
  ['other plugin', 'grafana-pathfinder-app', false, undefined],
])('selects conversation at invocation when %s', (_, pluginId, fullscreen, chatId) => {
  const { result } = renderHook(() => useAddToAssistant({ origin: 'grafana/test' }));
  // Visibility and active chat can change after the menu renders.
  store.set('grafana-assistant-active-chat-id', 'active-chat');
  if (pluginId) {
    store.set(EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY, getComponentIdFromComponentMeta(pluginId, 'Assistant'));
  }
  setFullscreenWorkspaceActive(fullscreen);
  result.current.addToAssistant(context);
  expect(openAssistant).toHaveBeenCalledWith({
    origin: 'grafana/test',
    context,
    autoSend: false,
    appendContext: true,
    chatId,
  });
});

it('ignores empty context without opening a conversation', () => {
  const { result } = renderHook(() => useAddToAssistant({ origin: 'grafana/test' }));
  expect(result.current.isAvailable).toBe(true);
  result.current.addToAssistant([]);
  expect(openAssistant).not.toHaveBeenCalled();
});

it.each([false, true])('disables adding context when unavailable (missing opener=%s)', (missingOpener) => {
  jest.mocked(useAssistant).mockReturnValue({
    isAvailable: missingOpener,
    isLoading: false,
    openAssistant: missingOpener ? undefined : openAssistant,
    closeAssistant: undefined,
    toggleAssistant: undefined,
  });
  const { result } = renderHook(() => useAddToAssistant({ origin: 'grafana/test' }));
  expect(result.current.isAvailable).toBe(false);
  result.current.addToAssistant(context);
  expect(openAssistant).not.toHaveBeenCalled();
});
