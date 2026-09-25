import { useCallback } from 'react';

import { type ChatContextItem, useAssistant } from '@grafana/assistant';

import { getAssistantChatIdToContinue } from './assistantSidebarState';

export function useAddToAssistant({ origin }: { origin: string }) {
  const { isAvailable: assistantAvailable, openAssistant } = useAssistant();
  const isAvailable = assistantAvailable && openAssistant != null;
  const addToAssistant = useCallback(
    (context: ChatContextItem[]) => {
      if (!isAvailable || !openAssistant || context.length === 0) {
        return;
      }

      openAssistant({
        origin,
        context,
        autoSend: false,
        appendContext: true,
        chatId: getAssistantChatIdToContinue(),
      });
    },
    [isAvailable, openAssistant, origin]
  );

  return { isAvailable, addToAssistant };
}
