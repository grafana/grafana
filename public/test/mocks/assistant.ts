// Mock for @grafana/assistant to prevent initialization errors in tests
// The real module tries to call getObservablePluginLinks() during initialization
// which fails because Grafana hasn't started. This mock prevents that.

import { of } from 'rxjs';

export const useAssistant = jest.fn().mockReturnValue({
  isAvailable: false,
  openAssistant: undefined,
  closeAssistant: jest.fn(),
  toggleAssistant: jest.fn(),
});

export const createAssistantContextItem = jest.fn();

// Additional exports that may be used
export const toggleAssistant = jest.fn();
export const isAssistantAvailable = jest.fn().mockReturnValue(of(false));

// Inline assistant mock for AI suggestions
export const useInlineAssistant = jest.fn().mockReturnValue({
  generate: jest.fn().mockResolvedValue(undefined),
  isGenerating: false,
  cancel: jest.fn(),
});

// Tool creation mock
export const createTool = jest.fn().mockImplementation((handler, config) => ({
  handler,
  ...config,
}));

// Type exports (if needed)
export type AssistantHook = ReturnType<typeof useAssistant>;
export type InlineAssistantHook = ReturnType<typeof useInlineAssistant>;
export type InlineToolRunnable = ReturnType<typeof createTool>;
export type ToolOutput = [string, unknown] | string;
