import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';

import { useGrafana } from 'app/core/context/GrafanaContext';

import { AssistantToolbarButtons } from './AssistantToolbarButtons';

jest.mock('@grafana/i18n', () => ({
  t: (_: string, fallback: string) => fallback,
}));

jest.mock('app/core/context/GrafanaContext', () => ({
  useGrafana: jest.fn(),
}));

const useGrafanaMock = jest.mocked(useGrafana);
const setFullscreenWorkspace = jest.fn();

describe('AssistantToolbarButtons', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGrafanaMock.mockReturnValue({ chrome: { setFullscreenWorkspace } } as unknown as ReturnType<typeof useGrafana>);
  });

  it('renders the Chat pill in its open state and an Enter Workspace button', () => {
    render(<AssistantToolbarButtons isOpen={false} />);

    const pill = screen.getByTestId('extension-toolbar-button-open');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveAttribute('aria-label', 'Open Grafana Assistant');
    expect(pill).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enter Workspace' })).toBeInTheDocument();
  });

  it('renders the Chat pill in its close state when open', () => {
    render(<AssistantToolbarButtons isOpen={true} />);

    const pill = screen.getByTestId('extension-toolbar-button-close');
    expect(pill).toHaveAttribute('aria-label', 'Close Grafana Assistant');
    expect(pill).toHaveAttribute('aria-expanded', 'true');
  });

  it('calls onClick when the Chat pill is clicked', () => {
    const onClick = jest.fn();
    render(<AssistantToolbarButtons isOpen={false} onClick={onClick} />);

    fireEvent.click(screen.getByTestId('extension-toolbar-button-open'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('enters fullscreen workspace when the Enter Workspace button is clicked', () => {
    render(<AssistantToolbarButtons isOpen={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Enter Workspace' }));

    expect(setFullscreenWorkspace).toHaveBeenCalledWith(true);
  });

  it('forwards the ref to the Chat pill button', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<AssistantToolbarButtons ref={ref} isOpen={false} />);

    expect(ref.current).toBe(screen.getByTestId('extension-toolbar-button-open'));
  });
});
