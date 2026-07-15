import { screen, fireEvent } from '@testing-library/react';

import { useFlagAssistantFullscreenWorkspace } from '@grafana/runtime/internal';
import { render } from 'test/test-utils';

import { ExtensionToolbarItemButton } from './ExtensionToolbarItemButton';

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useFlagAssistantFullscreenWorkspace: jest.fn(),
}));

const useFlagAssistantFullscreenWorkspaceMock = jest.mocked(useFlagAssistantFullscreenWorkspace);

describe('ExtensionToolbarItemButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useFlagAssistantFullscreenWorkspaceMock.mockReturnValue(false);
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

  it('renders the assistant Chat pill and Enter Workspace button when fullscreen workspace is enabled for the assistant plugin', () => {
    useFlagAssistantFullscreenWorkspaceMock.mockReturnValue(true);
    render(<ExtensionToolbarItemButton isOpen={false} pluginId="grafana-assistant-app" />);

    const pill = screen.getByTestId('extension-toolbar-button-open');
    expect(pill).toHaveAttribute('aria-label', 'Open Grafana Assistant');
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enter Workspace' })).toBeInTheDocument();
  });

  it('renders the default button for the assistant plugin when fullscreen workspace is disabled', () => {
    useFlagAssistantFullscreenWorkspaceMock.mockReturnValue(false);
    render(<ExtensionToolbarItemButton isOpen={false} pluginId="grafana-assistant-app" />);

    const button = screen.getByTestId('extension-toolbar-button-open');
    expect(button).toHaveAttribute('aria-label', 'Open AI assistants and sidebar apps');
    expect(screen.queryByRole('button', { name: 'Enter Workspace' })).not.toBeInTheDocument();
  });
});
