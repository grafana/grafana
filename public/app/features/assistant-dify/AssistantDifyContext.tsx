import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

export interface AssistantDifyMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  feedback?: 'up' | 'down';
}

export interface AssistantDifyContextType {
  isOpen: boolean;
  toggleAssistant: () => void;
  openAssistant: () => void;
  closeAssistant: () => void;
  messages: AssistantDifyMessage[];
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  clearMessages: () => void;
  setMessageFeedback: (id: string, feedback: 'up' | 'down') => void;
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;
  conversationId: string;
  setConversationId: (id: string) => void;
  userId: string;
}

const AssistantDifyContext = createContext<AssistantDifyContextType>({
  isOpen: false,
  toggleAssistant: () => {},
  openAssistant: () => {},
  closeAssistant: () => {},
  messages: [],
  addMessage: () => {},
  clearMessages: () => {},
  setMessageFeedback: () => {},
  isTyping: false,
  setIsTyping: () => {},
  conversationId: '',
  setConversationId: () => {},
  userId: 'grafana-assistant-user',
});

export function useAssistantDifyContext() {
  return useContext(AssistantDifyContext);
}

let messageIdCounter = 0;

export function AssistantDifyContextProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantDifyMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState('');
  const userId = useMemo(() => `grafana-user-${Date.now()}`, []);

  const toggleAssistant = useCallback(() => setIsOpen((prev) => !prev), []);
  const openAssistant = useCallback(() => setIsOpen(true), []);
  const closeAssistant = useCallback(() => setIsOpen(false), []);

  const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    const msg: AssistantDifyMessage = {
      id: `dify-msg-${++messageIdCounter}`,
      role,
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, msg]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId('');
  }, []);

  const setMessageFeedback = useCallback((id: string, feedback: 'up' | 'down') => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, feedback } : m)));
  }, []);

  return (
    <AssistantDifyContext.Provider
      value={{
        isOpen,
        toggleAssistant,
        openAssistant,
        closeAssistant,
        messages,
        addMessage,
        clearMessages,
        setMessageFeedback,
        isTyping,
        setIsTyping,
        conversationId,
        setConversationId,
        userId,
      }}
    >
      {children}
    </AssistantDifyContext.Provider>
  );
}
