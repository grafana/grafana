import { of } from 'rxjs';

// Mock for @grafana/assistant to prevent initialization errors in tests
// The real module tries to call getObservablePluginLinks() during initialization
// which fails because Grafana hasn't started. This mock prevents that.

export const useAssistant = jest.fn().mockReturnValue({
  isLoading: false,
  isAvailable: false,
  openAssistant: undefined,
  closeAssistant: jest.fn(),
  toggleAssistant: jest.fn(),
});

export const createAssistantContextItem = jest.fn();
export const useProvidePageContext = jest.fn().mockReturnValue(jest.fn());

// Additional exports that may be used
export const toggleAssistant = jest.fn();
export const isAssistantAvailable = jest.fn().mockReturnValue(of(false));

export const useInlineAssistant = jest.fn().mockReturnValue({
  generate: jest.fn().mockResolvedValue(undefined),
  isGenerating: false,
  content: '',
  error: null,
  cancel: jest.fn(),
  reset: jest.fn(),
});

// Type exports (if needed
export type AssistantHook = ReturnType<typeof useAssistant>;
