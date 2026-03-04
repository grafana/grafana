// Mock for @grafana/assistant to prevent initialization errors in tests
// The real module tries to call getObservablePluginLinks() during initialization
// which fails because Grafana hasn't started. This mock prevents that.

export const useAssistant = jest.fn().mockReturnValue({
  isAvailable: false,
  openAssistant: undefined,
  closeAssistant: jest.fn(),
  toggleAssistant: jest.fn(),
});

export const createAssistantContextItem = jest.fn();

// Additional exports that may be used
export const toggleAssistant = jest.fn();
export const isAssistantAvailable = jest.fn().mockReturnValue(false);

// Page context hooks
export const useProvidePageContext = jest.fn().mockReturnValue(jest.fn());
export const providePageContext = jest.fn().mockReturnValue(Object.assign(jest.fn(), { unregister: jest.fn() }));

// Function namespace exports
export const newFunctionNamespace = jest.fn(
  (namespace: string, functions: Record<string, (...args: unknown[]) => unknown>) => ({
    namespace,
    functions,
  })
);
export const getExposeAssistantFunctionsConfig = jest.fn(
  (namespaces: Array<{ namespace: string; functions: Record<string, (...args: unknown[]) => unknown> }>) => ({
    title: 'callback',
    targets: ['grafana-assistant-app/callback/v0-alpha'],
    fn: () => namespaces,
  })
);
export const CALLBACK_EXTENSION_POINT = 'grafana-assistant-app/callback/v0-alpha';

// Tool creation (createTool) – produces a minimal InlineToolRunnable for tests
export const createTool = jest.fn(
  (
    func: (input: unknown, options: unknown) => Promise<unknown>,
    options: {
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
      validate: (input: Record<string, unknown>) => unknown;
      metadata?: Record<string, unknown>;
      verboseParsingErrors?: boolean;
      responseFormat?: string;
    }
  ) => ({
    name: options.name,
    description: options.description,
    inputSchema: options.inputSchema,
    metadata: options.metadata ?? {},
    responseFormat: options.responseFormat,
    verboseParsingErrors: options.verboseParsingErrors,
    invoke: async (input: Record<string, unknown>, invokeOptions: unknown) => {
      const parsedInput = options.validate(input);
      return func(parsedInput, invokeOptions);
    },
  })
);

// Type exports (if needed)
export type AssistantHook = ReturnType<typeof useAssistant>;
