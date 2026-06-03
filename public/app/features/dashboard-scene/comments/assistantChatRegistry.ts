const STORAGE_KEY = 'grafana.dashboard-comments.assistant-chats';
const MAX_CHATS = 30;

export interface AssistantChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantChatRef {
  chatId: string;
  title: string;
  messages: AssistantChatMessage[];
  updatedAt: number;
}

function readAll(): AssistantChatRef[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as AssistantChatRef[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(chats: AssistantChatRef[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, MAX_CHATS)));
}

export function listAssistantChats(): AssistantChatRef[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getAssistantChat(chatId: string): AssistantChatRef | undefined {
  return readAll().find((c) => c.chatId === chatId);
}

export function upsertAssistantChat(chat: AssistantChatRef) {
  const chats = readAll().filter((c) => c.chatId !== chat.chatId);
  chats.unshift(chat);
  writeAll(chats);
}

export function recordAssistantChatTurn(
  chatId: string,
  title: string,
  userMessage: string,
  assistantMessage: string
) {
  const existing = getAssistantChat(chatId);
  const messages: AssistantChatMessage[] = existing?.messages ? [...existing.messages] : [];
  messages.push({ role: 'user', content: userMessage });
  messages.push({ role: 'assistant', content: assistantMessage });
  upsertAssistantChat({
    chatId,
    title: title || existing?.title || 'Assistant chat',
    messages,
    updatedAt: Date.now(),
  });
}

export function recordAssistantChatFromSidebar(chatId: string, title: string, messages: AssistantChatMessage[]) {
  if (!chatId || messages.length === 0) {
    return;
  }
  upsertAssistantChat({
    chatId,
    title,
    messages,
    updatedAt: Date.now(),
  });
}
