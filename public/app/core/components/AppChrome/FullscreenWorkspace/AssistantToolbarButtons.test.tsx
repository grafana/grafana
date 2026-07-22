import { createRef } from 'react';
import { getWrapper, render, screen, fireEvent } from 'test/test-utils';

import { AppChromeService } from 'app/core/components/AppChrome/AppChromeService';

import { AssistantToolbarButtons } from './AssistantToolbarButtons';

function renderButtons(props: Partial<React.ComponentProps<typeof AssistantToolbarButtons>> = {}) {
  const chrome = new AppChromeService();
  const wrapper = getWrapper({ grafanaContext: { chrome } });
  return { chrome, ...render(<AssistantToolbarButtons isOpen={false} {...props} />, { wrapper }) };
}

describe('AssistantToolbarButtons', () => {
  it('renders the Chat pill in its open state and an Enter Workspace button', () => {
    renderButtons({ isOpen: false });

    const pill = screen.getByTestId('extension-toolbar-button-open');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveAttribute('aria-label', 'Open Grafana Assistant');
    expect(pill).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enter Workspace' })).toBeInTheDocument();
  });

  it('renders the Chat pill in its close state when open', () => {
    renderButtons({ isOpen: true });

    const pill = screen.getByTestId('extension-toolbar-button-close');
    expect(pill).toHaveAttribute('aria-label', 'Close Grafana Assistant');
    expect(pill).toHaveAttribute('aria-expanded', 'true');
  });

  it('calls onClick when the Chat pill is clicked', () => {
    const onClick = jest.fn();
    renderButtons({ isOpen: false, onClick });

    fireEvent.click(screen.getByTestId('extension-toolbar-button-open'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('enters fullscreen workspace when the Enter Workspace button is clicked', () => {
    const { chrome } = renderButtons({ isOpen: false });

    fireEvent.click(screen.getByRole('button', { name: 'Enter Workspace' }));

    expect(chrome.state.getValue().fullscreenWorkspace).toBe(true);
  });

  it('forwards the ref to the Chat pill button', () => {
    const ref = createRef<HTMLButtonElement>();
    const chrome = new AppChromeService();
    const wrapper = getWrapper({ grafanaContext: { chrome } });
    render(<AssistantToolbarButtons ref={ref} isOpen={false} />, { wrapper });

    expect(ref.current).toBe(screen.getByTestId('extension-toolbar-button-open'));
  });
});
