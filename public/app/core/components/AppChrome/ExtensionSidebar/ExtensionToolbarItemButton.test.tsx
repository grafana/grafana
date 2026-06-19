import { render, screen, fireEvent } from '@testing-library/react';

import { useFlagAssistantAgentMode } from '@grafana/runtime/internal';

import { ExtensionToolbarItemButton } from './ExtensionToolbarItemButton';

// Mock the t function
jest.mock('@grafana/i18n', () => ({
  t: (_: string, fallback: string, values?: Record<string, string>) => {
    if (values) {
      return fallback.replace('{{title}}', values.title);
    }
    return fallback;
  },
}));

jest.mock('@grafana/runtime/internal', () => ({
  useFlagAssistantAgentMode: jest.fn(),
}));

jest.mock('../AgentMode/AssistantToolbarButtons', () => ({
  AssistantToolbarButtons: () => <div data-testid="assistant-toolbar-buttons" />,
}));

const useFlagAssistantAgentModeMock = jest.mocked(useFlagAssistantAgentMode);

describe('ExtensionToolbarItemButton', () => {
  beforeEach(() => {
    useFlagAssistantAgentModeMock.mockReturnValue(false);
  });
  it('renders open button with default tooltip when no title is provided', () => {
    render(<ExtensionToolbarItemButton isOpen={false} />);

    const button = screen.getByTestId('extension-toolbar-button-open');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Open AI assistants and sidebar apps');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders open button with custom tooltip when title is provided', () => {
    render(<ExtensionToolbarItemButton isOpen={false} title="Test App" />);

    const button = screen.getByTestId('extension-toolbar-button-open');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Open Test App');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders close button with custom tooltip when isOpen is true', () => {
    render(<ExtensionToolbarItemButton isOpen={true} title="Test App" />);

    const button = screen.getByTestId('extension-toolbar-button-close');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Close Test App');
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('calls onClick handler when button is clicked', () => {
    const handleClick = jest.fn();
    render(<ExtensionToolbarItemButton isOpen={false} onClick={handleClick} />);

    const button = screen.getByTestId('extension-toolbar-button-open');
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders the assistant toolbar buttons when agent mode is enabled for the assistant plugin', () => {
    useFlagAssistantAgentModeMock.mockReturnValue(true);
    render(<ExtensionToolbarItemButton isOpen={false} pluginId="grafana-assistant-app" />);

    expect(screen.getByTestId('assistant-toolbar-buttons')).toBeInTheDocument();
    expect(screen.queryByTestId('extension-toolbar-button-open')).not.toBeInTheDocument();
  });

  it('renders the default button for the assistant plugin when agent mode is disabled', () => {
    useFlagAssistantAgentModeMock.mockReturnValue(false);
    render(<ExtensionToolbarItemButton isOpen={false} pluginId="grafana-assistant-app" />);

    expect(screen.getByTestId('extension-toolbar-button-open')).toBeInTheDocument();
    expect(screen.queryByTestId('assistant-toolbar-buttons')).not.toBeInTheDocument();
  });
});
