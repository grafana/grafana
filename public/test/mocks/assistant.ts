import { of } from 'rxjs';

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
export const isAssistantAvailable = jest.fn().mockReturnValue(of(false));

export const useInlineAssistant = jest.fn().mockReturnValue({
  generate: jest.fn().mockResolvedValue(undefined),
  isGenerating: false,
  content: '',
  error: null,
  cancel: jest.fn(),
  reset: jest.fn(),
});

// Stub components for AITextInput and AITextArea
type AIMockProps = {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  'data-testid'?: string;
};

export const AITextInput = jest.fn(({ value, onChange, ...props }: AIMockProps) => {
  const React = require('react');
  return React.createElement('input', {
    value,
    onChange: (e: { target: { value: string } }) => onChange?.(e.target.value),
    'data-testid': props['data-testid'],
    placeholder: props.placeholder,
  });
});

export const AITextArea = jest.fn(({ value, onChange, ...props }: AIMockProps) => {
  const React = require('react');
  return React.createElement('textarea', {
    value,
    onChange: (e: { target: { value: string } }) => onChange?.(e.target.value),
    'data-testid': props['data-testid'],
    placeholder: props.placeholder,
  });
});

// Type exports (if needed
export type AssistantHook = ReturnType<typeof useAssistant>;
