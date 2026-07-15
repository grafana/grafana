import { act } from '@testing-library/react';
import { render, screen, fireEvent } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';

import { ExtensionToolbarItemButton } from './ExtensionToolbarItemButton';

const FULLSCREEN_WORKSPACE_FLAG = 'assistant.fullscreenWorkspace';

describe('ExtensionToolbarItemButton', () => {
  afterEach(async () => {
    // setTestFlags fires OpenFeature events that update React state; wrap in act() since the
    // component may still be mounted when this runs (RTL cleanup is a separate afterEach).
    await act(async () => {
      setTestFlags({});
    });
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

  it('renders the assistant Chat pill and Enter Workspace button when fullscreen workspace is enabled for the assistant plugin', async () => {
    setTestFlags({ [FULLSCREEN_WORKSPACE_FLAG]: true });
    render(<ExtensionToolbarItemButton isOpen={false} pluginId="grafana-assistant-app" />);

    expect(await screen.findByRole('button', { name: 'Enter Workspace' })).toBeInTheDocument();
    const pill = screen.getByTestId('extension-toolbar-button-open');
    expect(pill).toHaveAttribute('aria-label', 'Open Grafana Assistant');
    expect(screen.getByText('Chat')).toBeInTheDocument();
  });

  it('renders the default button for the assistant plugin when fullscreen workspace is disabled', () => {
    setTestFlags({ [FULLSCREEN_WORKSPACE_FLAG]: false });
    render(<ExtensionToolbarItemButton isOpen={false} pluginId="grafana-assistant-app" />);

    const button = screen.getByTestId('extension-toolbar-button-open');
    expect(button).toHaveAttribute('aria-label', 'Open AI assistants and sidebar apps');
    expect(screen.queryByRole('button', { name: 'Enter Workspace' })).not.toBeInTheDocument();
  });
});
