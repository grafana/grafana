import { render, screen, fireEvent } from 'test/test-utils';

import { ExtensionToolbarItemButton } from './ExtensionToolbarItemButton';

describe('ExtensionToolbarItemButton', () => {
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

  it('renders the default button for the assistant plugin', () => {
    render(<ExtensionToolbarItemButton isOpen={false} pluginId="grafana-assistant-app" />);

    const button = screen.getByTestId('extension-toolbar-button-open');
    expect(button).toHaveAttribute('aria-label', 'Open AI assistants and sidebar apps');
  });
});
