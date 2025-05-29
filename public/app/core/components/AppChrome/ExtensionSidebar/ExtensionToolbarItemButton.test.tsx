import { render, screen, fireEvent } from '@testing-library/react';

import { useTranslate } from '@grafana/i18n';

import { ExtensionToolbarItemButton } from './ExtensionToolbarItemButton';

// Mock the useTranslate hook
jest.mock('@grafana/i18n', () => ({
  useTranslate: jest.fn(),
}));

describe('ExtensionToolbarItemButton', () => {
  const mockTranslate = (_: string, fallback: string, values?: Record<string, string>) => {
    if (values) {
      return fallback.replace('{{title}}', values.title);
    }
    return fallback;
  };

  beforeEach(() => {
    (useTranslate as jest.Mock).mockReturnValue({ t: mockTranslate });
  });

  it('renders open button with default tooltip when no title is provided', () => {
    render(<ExtensionToolbarItemButton isOpen={false} />);

    const button = screen.getByTestId('extension-toolbar-button-open');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Open AI assistants and sidebar apps');
  });

  it('renders open button with custom tooltip when title is provided', () => {
    render(<ExtensionToolbarItemButton isOpen={false} title="Test App" />);

    const button = screen.getByTestId('extension-toolbar-button-open');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Open Test App');
  });

  it('renders close button with custom tooltip when isOpen is true', () => {
    render(<ExtensionToolbarItemButton isOpen={true} title="Test App" />);

    const button = screen.getByTestId('extension-toolbar-button-close');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Close Test App');
  });

  it('calls onClick handler when button is clicked', () => {
    const handleClick = jest.fn();
    render(<ExtensionToolbarItemButton isOpen={false} onClick={handleClick} />);

    const button = screen.getByTestId('extension-toolbar-button-open');
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
