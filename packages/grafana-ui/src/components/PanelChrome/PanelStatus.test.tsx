import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import { PanelStatus } from './PanelStatus';
import { type PanelStatusItem } from './types';

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

    it('shows a tooltip listing all items on hover', async () => {
      render(<PanelStatus items={[{ severity: 'error', text: 'Preparing expression failed' }, ...items]} />);

      // Tooltip content is not shown until the trigger is hovered.
      expect(screen.queryByText('Errors and notices')).not.toBeInTheDocument();

      await userEvent.hover(screen.getByTestId(selectors.components.Panels.Panel.status('error')));

      expect(await screen.findByText('Errors and notices')).toBeInTheDocument();
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

      await userEvent.hover(screen.getByTestId(selectors.components.Panels.Panel.status('error')));

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

      await userEvent.hover(screen.getByTestId(selectors.components.Panels.Panel.status('error')));
      await screen.findByText('first error');

      const texts = [
        'first error',
        'second error',
        'first warning',
        'second warning',
        'first info',
        'second info',
      ].map((text) => screen.getByText(text));

      for (let i = 0; i < texts.length - 1; i++) {
        expect(texts[i].compareDocumentPosition(texts[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    });

    it('calls onClick (inspect) from the tooltip', async () => {
      const onClick = jest.fn();
      render(<PanelStatus items={items} onClick={onClick} />);

      await userEvent.hover(screen.getByTestId(selectors.components.Panels.Panel.status('warning')));
      await userEvent.click(await screen.findByRole('button', { name: 'Inspect' }));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not render an Inspect button when no onClick is provided', async () => {
      render(<PanelStatus items={items} />);

      await userEvent.hover(screen.getByTestId(selectors.components.Panels.Panel.status('warning')));
      expect(await screen.findByText('Errors and notices')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Inspect' })).not.toBeInTheDocument();
    });
  });

  it('renders nothing meaningful when neither message nor items are provided', () => {
    // With an empty items array it should still fall back to the legacy button rather than crash.
    const { container } = render(<PanelStatus items={[]} message="" />);
    expect(container).toBeInTheDocument();
  });
});
