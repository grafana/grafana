import React from 'react';
import { of } from 'rxjs';

// Mock for @grafana/assistant to prevent initialization errors in tests.
// The real module calls getObservablePluginLinks() during init which fails in tests.

export const useAssistant = jest.fn().mockReturnValue({
  isLoading: false,
  isAvailable: false,
  openAssistant: undefined,
  closeAssistant: jest.fn(),
  toggleAssistant: jest.fn(),
});

export const createAssistantContextItem = jest.fn();
export const useProvidePageContext = jest.fn().mockReturnValue(jest.fn());
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

export const AITextInput = jest.fn(
  ({ value, onChange, placeholder, 'data-testid': testId }: Record<string, unknown>) =>
    React.createElement('input', {
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => (onChange as Function)?.(e.target.value),
      'data-testid': testId,
      placeholder,
    })
);

export const AITextArea = jest.fn(
  ({ value, onChange, placeholder, 'data-testid': testId }: Record<string, unknown>) =>
    React.createElement('textarea', {
      value,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => (onChange as Function)?.(e.target.value),
      'data-testid': testId,
      placeholder,
    })
);

export type AssistantHook = ReturnType<typeof useAssistant>;
