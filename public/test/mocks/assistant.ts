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

export const OpenAssistantButton = jest.fn().mockReturnValue(null);

// Additional exports that may be used
export const toggleAssistant = jest.fn();
export const isAssistantAvailable = jest.fn().mockReturnValue(false);

// Assistant callback-function helpers (pure functions in the real module, mirrored
// here so core code can expose functions to the assistant in tests).
export const CALLBACK_EXTENSION_POINT = 'grafana-assistant-app/callback/v0-alpha';

export function newFunctionNamespace(namespace: string, functions: Record<string, (...args: unknown[]) => unknown>) {
  return { namespace, functions };
}

export function getExposeAssistantFunctionsConfig(namespaces: Array<ReturnType<typeof newFunctionNamespace>>) {
  return {
    title: 'callback',
    targets: [CALLBACK_EXTENSION_POINT],
    fn: () => namespaces,
  };
}

// Type exports (if needed
export type AssistantHook = ReturnType<typeof useAssistant>;
