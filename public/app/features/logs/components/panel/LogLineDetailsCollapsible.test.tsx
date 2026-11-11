import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LogLineDetailsCollapsible } from './LogLineDetailsCollapsible';
import { LogListContext } from './LogListContext';
import { defaultValue } from './__mocks__/LogListContext';

jest.mock('./LogListContext');

const STORAGE_KEY = 'log-details-collapsible-test';

function collapsible({
  defaultExpanded = true,
  logOptionsStorageKey = STORAGE_KEY as string | undefined,
  syntaxHighlightingUnavailable = false,
}: {
  defaultExpanded?: boolean;
  logOptionsStorageKey?: string;
  syntaxHighlightingUnavailable?: boolean;
} = {}) {
  return (
    <LogListContext.Provider value={{ ...defaultValue, logOptionsStorageKey, syntaxHighlightingUnavailable }}>
      <LogLineDetailsCollapsible defaultExpanded={defaultExpanded} id="service" label="Service">
        checkout
      </LogLineDetailsCollapsible>
      <LogLineDetailsCollapsible defaultExpanded={false} id="log-line" label="Log line">
        log message 1
      </LogLineDetailsCollapsible>
    </LogListContext.Provider>
  );
}

describe('LogLineDetailsCollapsible', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each([
    { logOptionsStorageKey: STORAGE_KEY, name: 'with no stored preference' },
    { logOptionsStorageKey: undefined, name: 'when expand state is not persisted' },
  ])(
    'reopens a default-expanded category $name when syntax highlighting becomes available',
    ({ logOptionsStorageKey }) => {
      const view = render(collapsible({ logOptionsStorageKey }));

      expect(screen.getByRole('button', { name: 'Service' })).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('checkout')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Log line' })).toHaveAttribute('aria-expanded', 'false');

      view.rerender(collapsible({ logOptionsStorageKey, syntaxHighlightingUnavailable: true }));

      expect(screen.getByRole('button', { name: 'Service' })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText('checkout')).not.toBeInTheDocument();

      view.rerender(collapsible({ logOptionsStorageKey, syntaxHighlightingUnavailable: false }));

      expect(screen.getByRole('button', { name: 'Service' })).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('checkout')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Log line' })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText('log message 1')).not.toBeInTheDocument();
    }
  );

  it('restores the stored expand state when syntax highlighting becomes available', async () => {
    const user = userEvent.setup();
    const view = render(collapsible());

    await user.click(screen.getByRole('button', { name: 'Service' }));
    await user.click(screen.getByRole('button', { name: 'Log line' }));

    expect(screen.getByRole('button', { name: 'Service' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Log line' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('log message 1')).toBeInTheDocument();

    view.rerender(collapsible({ syntaxHighlightingUnavailable: true }));

    expect(screen.getByRole('button', { name: 'Log line' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('log message 1')).not.toBeInTheDocument();

    view.rerender(collapsible({ syntaxHighlightingUnavailable: false }));

    expect(screen.getByRole('button', { name: 'Service' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('checkout')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log line' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('log message 1')).toBeInTheDocument();
  });
});
