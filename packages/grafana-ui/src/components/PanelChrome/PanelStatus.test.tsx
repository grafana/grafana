import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement } from 'react';

import { EventBusSrv } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { type PanelContext, PanelContextProvider } from './PanelContext';
import { PanelStatus } from './PanelStatus';
import { type PanelStatusItem } from './types';

function renderWithPanelContext(ui: ReactElement, context: Partial<PanelContext> = {}) {
  return render(
    <PanelContextProvider value={{ eventsScope: 'global', eventBus: new EventBusSrv(), ...context }}>
      {ui}
    </PanelContextProvider>
  );
}

describe('PanelStatus', () => {
  describe('legacy single message', () => {
    it('renders an error button with the message as tooltip', () => {
      render(<PanelStatus message="Something went wrong" />);

      const button = screen.getByTestId(selectors.components.Panels.Panel.status('error'));
      expect(button).toBeInTheDocument();
    });

    it('calls onClick when the button is clicked', async () => {
      const onClick = jest.fn();
      render(<PanelStatus message="boom" onClick={onClick} />);

      await userEvent.click(screen.getByTestId(selectors.components.Panels.Panel.status('error')));
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('structured items popover', () => {
    const items: PanelStatusItem[] = [
      { severity: 'warning', text: 'Query marked as big' },
      { severity: 'info', text: 'Window size adjusted' },
    ];

    it('uses the topmost severity for the trigger icon', () => {
      render(<PanelStatus items={[{ severity: 'error', text: 'failed' }, ...items]} />);

      // The error item is the most severe, so the trigger uses the error status testid.
      expect(screen.getByTestId(selectors.components.Panels.Panel.status('error'))).toBeInTheDocument();
    });

    it('falls back to warning when there is no error', () => {
      render(<PanelStatus items={items} />);
      expect(screen.getByTestId(selectors.components.Panels.Panel.status('warning'))).toBeInTheDocument();
    });

    it('does not call onClick (inspect) directly - clicking the trigger opens the popover instead', async () => {
      const onClick = jest.fn();
      render(<PanelStatus items={items} onClick={onClick} />);

      expect(screen.queryByTestId('toggletip-content')).not.toBeInTheDocument();

      await userEvent.click(screen.getByTestId(selectors.components.Panels.Panel.status('warning')));

      expect(await screen.findByTestId('toggletip-content')).toBeInTheDocument();
      expect(onClick).not.toHaveBeenCalled();
    });

    it('shows a popover listing all items on click', async () => {
      render(<PanelStatus items={[{ severity: 'error', text: 'Preparing expression failed' }, ...items]} />);

      // Popover content is not shown until the trigger is clicked.
      expect(screen.queryByTestId('toggletip-content')).not.toBeInTheDocument();

      await userEvent.click(screen.getByTestId(selectors.components.Panels.Panel.status('error')));

      expect(await screen.findByTestId('toggletip-content')).toBeInTheDocument();
      expect(screen.getByText('Preparing expression failed')).toBeInTheDocument();
      expect(screen.getByText('Query marked as big')).toBeInTheDocument();
      expect(screen.getByText('Window size adjusted')).toBeInTheDocument();
    });

    it('lists items sorted error > warning > info regardless of input order', async () => {
      render(
        <PanelStatus
          items={[
            { severity: 'info', text: 'an info notice' },
            { severity: 'warning', text: 'a warning notice' },
            { severity: 'error', text: 'an error' },
          ]}
        />
      );

      await userEvent.click(screen.getByTestId(selectors.components.Panels.Panel.status('error')));

      const error = await screen.findByText('an error');
      const warning = screen.getByText('a warning notice');
      const info = screen.getByText('an info notice');
      expect(error.compareDocumentPosition(warning) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(warning.compareDocumentPosition(info) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('groups multiple items per severity, preserving input order within a severity', async () => {
      render(
        <PanelStatus
          items={[
            { severity: 'info', text: 'first info' },
            { severity: 'warning', text: 'first warning' },
            { severity: 'error', text: 'first error' },
            { severity: 'info', text: 'second info' },
            { severity: 'error', text: 'second error' },
            { severity: 'warning', text: 'second warning' },
          ]}
        />
      );

      await userEvent.click(screen.getByTestId(selectors.components.Panels.Panel.status('error')));
      await screen.findByText('first error');

      const texts = ['first error', 'second error', 'first warning', 'second warning', 'first info', 'second info'].map(
        (text) => screen.getByText(text)
      );

      for (let i = 0; i < texts.length - 1; i++) {
        expect(texts[i].compareDocumentPosition(texts[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    });

    it('renders an Inspect button in the popover and calls onClick (inspect) when clicked', async () => {
      const onClick = jest.fn();
      render(<PanelStatus items={items} onClick={onClick} />);

      await userEvent.click(screen.getByTestId(selectors.components.Panels.Panel.status('warning')));
      const inspectButton = await screen.findByRole('button', { name: 'Inspect' });

      await userEvent.click(inspectButton);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not render an assistant button when no onInvestigateErrors is provided', async () => {
      render(<PanelStatus items={items} />);

      await userEvent.click(screen.getByTestId(selectors.components.Panels.Panel.status('warning')));
      expect(await screen.findByTestId('toggletip-content')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /with Assistant$/ })).not.toBeInTheDocument();
    });

    it('does not render an Inspect button when no onClick is provided', async () => {
      render(<PanelStatus items={items} />);

      await userEvent.click(screen.getByTestId(selectors.components.Panels.Panel.status('warning')));
      expect(await screen.findByTestId('toggletip-content')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Inspect' })).not.toBeInTheDocument();
    });

    it('renders a single Fix with Assistant button and calls onInvestigateErrors when clicked', async () => {
      const onInvestigateErrors = jest.fn();
      renderWithPanelContext(
        <PanelStatus items={[{ severity: 'error', text: 'Preparing expression failed' }, ...items]} />,
        { onInvestigateErrors }
      );

      await userEvent.click(screen.getByTestId(selectors.components.Panels.Panel.status('error')));
      const button = await screen.findByRole('button', { name: 'Fix with Assistant' });

      await userEvent.click(button);
      expect(onInvestigateErrors).toHaveBeenCalledTimes(1);
    });

    it('offers to explain rather than fix when there are no errors to fix', async () => {
      // `items` here is warning + info only, which is the case where the dashboard side asks the
      // assistant to explain the notices instead of fixing anything.
      renderWithPanelContext(<PanelStatus items={items} />, { onInvestigateErrors: jest.fn() });

      await userEvent.click(screen.getByTestId(selectors.components.Panels.Panel.status('warning')));

      expect(await screen.findByRole('button', { name: 'Explain with Assistant' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Fix with Assistant' })).not.toBeInTheDocument();
    });

    it('places the assistant button before the Inspect button', async () => {
      renderWithPanelContext(
        <PanelStatus
          items={[{ severity: 'error', text: 'Preparing expression failed' }, ...items]}
          onClick={jest.fn()}
        />,
        { onInvestigateErrors: jest.fn() }
      );

      await userEvent.click(screen.getByTestId(selectors.components.Panels.Panel.status('error')));

      const assistantButton = await screen.findByRole('button', { name: 'Fix with Assistant' });
      const inspectButton = screen.getByRole('button', { name: 'Inspect' });

      expect(assistantButton.compareDocumentPosition(inspectButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('traps focus within the popover and returns it to the trigger on Escape', async () => {
      // The portaled popover content sits elsewhere in the DOM than the trigger, so this only
      // reproduces the real page's Tab order if there's another focusable element right after the
      // trigger for focus to potentially escape to.
      renderWithPanelContext(
        <>
          <PanelStatus items={[{ severity: 'error', text: 'Preparing expression failed' }, ...items]} />
          <button>Next focusable element on the page</button>
        </>,
        { onInvestigateErrors: jest.fn() }
      );

      const trigger = screen.getByTestId(selectors.components.Panels.Panel.status('error'));
      await userEvent.click(trigger);

      const closeButton = await screen.findByTestId('toggletip-header-close');
      // Toggletip focuses its own close button first, per its own focus-management contract.
      await waitFor(() => {
        expect(closeButton).toHaveFocus();
      });

      await userEvent.keyboard('{Escape}');
      expect(trigger).toHaveFocus();
      expect(screen.queryByTestId('toggletip-content')).not.toBeInTheDocument();

      await userEvent.tab();
      expect(screen.getByRole('button', { name: 'Next focusable element on the page' })).toHaveFocus();
    });
  });

  it('renders nothing meaningful when neither message nor items are provided', () => {
    // With an empty items array it should still fall back to the legacy button rather than crash.
    const { container } = render(<PanelStatus items={[]} message="" />);
    expect(container).toBeInTheDocument();
  });
});
