import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { render, screen } from 'test/test-utils';

import { RuleSearchInput } from './RuleSearchInput';
import { alertTokens } from './alertTokens';
import { parse } from './parser';
import { serialize } from './serializer';
import { type TokenDefinition } from './tokens';

/** Owns the applied query the way a page does: the canonical form of whatever was applied. */
function PageLikeInput({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  return (
    <>
      <RuleSearchInput
        query={query}
        onApply={(raw) => setQuery(serialize(parse(raw, alertTokens).criteria))}
        tokens={alertTokens}
        debounceMs={0}
      />
      <button onClick={() => setQuery('')}>Clear filters</button>
      <output aria-label="applied query">{query}</output>
    </>
  );
}

describe('RuleSearchInput', () => {
  it('SEARCH-1: applies a valid edit after the debounce, not on every keystroke', async () => {
    // Fake timers make the debounce deterministic: with real timers, userEvent's own
    // per-keystroke delay can exceed a short debounce under load, firing onApply early on a
    // partial value instead of waiting for the full "cpu". advanceTimers ties userEvent's
    // internal waits to the same fake clock so typing still resolves.
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onApply = jest.fn();
    render(<RuleSearchInput query="" onApply={onApply} tokens={alertTokens} debounceMs={400} />);

    await user.type(screen.getByRole('textbox', { name: /search/i }), 'cpu');
    expect(onApply).not.toHaveBeenCalled();

    jest.advanceTimersByTime(400);
    expect(onApply).toHaveBeenCalledWith('cpu');
    expect(onApply).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('SEARCH-1: Enter applies immediately, without waiting for the debounce', async () => {
    const user = userEvent.setup();
    const onApply = jest.fn();
    render(<RuleSearchInput query="" onApply={onApply} tokens={alertTokens} debounceMs={10_000} />);

    const input = screen.getByRole('textbox', { name: /search/i });
    await user.type(input, 'cpu{Enter}');

    expect(onApply).toHaveBeenCalledWith('cpu');
  });

  it('SEARCH-1: blur applies the current draft immediately', async () => {
    const user = userEvent.setup();
    const onApply = jest.fn();
    render(
      <div>
        <RuleSearchInput query="" onApply={onApply} tokens={alertTokens} debounceMs={10_000} />
        <button>elsewhere</button>
      </div>
    );

    await user.type(screen.getByRole('textbox', { name: /search/i }), 'cpu');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));

    expect(onApply).toHaveBeenCalledWith('cpu');
  });

  it('resyncs the draft when the applied query changes externally (e.g. Clear filters)', () => {
    const { rerender } = render(<RuleSearchInput query="cpu" onApply={jest.fn()} tokens={alertTokens} />);
    expect(screen.getByRole('textbox', { name: /search/i })).toHaveValue('cpu');

    rerender(<RuleSearchInput query="" onApply={jest.fn()} tokens={alertTokens} />);
    expect(screen.getByRole('textbox', { name: /search/i })).toHaveValue('');
  });

  it('NAV-5: marks the input as invalid and names each filter that could not be applied', () => {
    render(
      <RuleSearchInput
        query="foo:bar"
        onApply={jest.fn()}
        tokens={alertTokens}
        issues={[{ key: 'foo', reason: 'unsupported' }]}
      />
    );

    const input = screen.getByRole('textbox', { name: /search/i });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveValue('foo:bar');
    expect(screen.getByText('Some filters could not be applied: foo')).toBeInTheDocument();
  });

  it('SEARCH-1: keeps a multi-token query exactly as typed after it is applied', async () => {
    const user = userEvent.setup();
    render(<PageLikeInput />);
    const typed = 'label:team=api cpu namespace:folder-1 foo:bar label:';

    await user.type(screen.getByRole('textbox', { name: /search/i }), `${typed}{Enter}`);

    expect(screen.getByRole('textbox', { name: /search/i })).toHaveValue(typed);
    // The applied query is the canonical form, which orders tokens differently and is what the URL gets.
    expect(screen.getByLabelText('applied query')).toHaveTextContent(
      'namespace:folder-1 label:team=api foo:bar label: cpu'
    );
  });

  it('SEARCH-1: does not apply a half-typed filter while typing, only on Enter', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onApply = jest.fn();
    render(<RuleSearchInput query="" onApply={onApply} tokens={alertTokens} debounceMs={400} />);

    await user.type(screen.getByRole('textbox', { name: /search/i }), 'cpu label:');
    jest.advanceTimersByTime(1000);
    expect(onApply).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    expect(onApply).toHaveBeenCalledWith('cpu label:');

    jest.useRealTimers();
  });

  it('SEARCH-1: replaces the draft when the applied query changes from outside', async () => {
    const user = userEvent.setup();
    render(<PageLikeInput />);

    await user.type(screen.getByRole('textbox', { name: /search/i }), 'cpu{Enter}');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.getByRole('textbox', { name: /search/i })).toHaveValue('');
  });

  it('SEARCH-1: does not apply again on blur when the text is already applied', async () => {
    const user = userEvent.setup();
    const onApply = jest.fn();
    render(
      <div>
        <RuleSearchInput query="namespace:folder-1" onApply={onApply} tokens={alertTokens} />
        <button>elsewhere</button>
      </div>
    );

    await user.click(screen.getByRole('textbox', { name: /search/i }));
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));

    expect(onApply).not.toHaveBeenCalled();
  });

  it('SEARCH-6: the help popover lists an example for every token in the given registry', async () => {
    const user = userEvent.setup();
    render(<RuleSearchInput query="" onApply={jest.fn()} tokens={alertTokens} />);

    await user.click(screen.getByTitle('Search help'));

    for (const token of alertTokens) {
      expect(screen.getByText(token.example)).toBeInTheDocument();
    }
  });

  it('SEARCH-6: the help popover names each filter and says which ones are available', async () => {
    const user = userEvent.setup();
    const tokens: TokenDefinition[] = [
      {
        key: 'folder',
        label: () => 'Folder',
        description: () => 'Folder to search in.',
        example: 'folder:uid',
        availability: { status: 'supported' },
      },
      {
        key: 'later',
        label: () => 'Later filter',
        description: () => 'Not built yet.',
        example: 'later:value',
        availability: { status: 'unavailable', reason: () => 'Needs a backend change.' },
      },
    ];
    render(<RuleSearchInput query="" onApply={jest.fn()} tokens={tokens} />);

    await user.click(screen.getByTitle('Search help'));

    expect(screen.getByText('Folder')).toBeInTheDocument();
    expect(screen.getByText('Later filter')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Not available yet')).toBeInTheDocument();
    expect(screen.getByText('Needs a backend change.')).toBeInTheDocument();
  });

  it('SEARCH-6: the help popover explains that the default notification policy cannot be searched yet', async () => {
    const user = userEvent.setup();
    render(<RuleSearchInput query="" onApply={jest.fn()} tokens={alertTokens} />);

    await user.click(screen.getByTitle('Search help'));

    expect(screen.getByText('Notification policy')).toBeInTheDocument();
    expect(screen.getByText("Filtering by the default policy isn't available yet.")).toBeInTheDocument();
  });
});
