import userEvent from '@testing-library/user-event';
import { render, screen } from 'test/test-utils';

import { RuleSearchInput } from './RuleSearchInput';
import { alertTokens } from './alertTokens';

describe('RuleSearchInput', () => {
  it('SEARCH-1.2: applies a valid edit after the debounce, not on every keystroke', async () => {
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

  it('SEARCH-1.3: Enter applies immediately, without waiting for the debounce', async () => {
    const user = userEvent.setup();
    const onApply = jest.fn();
    render(<RuleSearchInput query="" onApply={onApply} tokens={alertTokens} debounceMs={10_000} />);

    const input = screen.getByRole('textbox', { name: /search/i });
    await user.type(input, 'cpu{Enter}');

    expect(onApply).toHaveBeenCalledWith('cpu');
  });

  it('SEARCH-1.4: blur applies the current draft immediately', async () => {
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

  it('SEARCH-6.1: marks the input as invalid and describes each unresolved token when issues are present', () => {
    render(
      <RuleSearchInput
        query="namespace:unknown-folder"
        onApply={jest.fn()}
        tokens={alertTokens}
        issues={[{ key: 'namespace', reason: 'unresolved', value: 'unknown-folder' }]}
      />
    );

    const input = screen.getByRole('textbox', { name: /search/i });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/namespace/)).toBeInTheDocument();
  });

  it('SEARCH-6.4: the help popover lists an example for every token in the given registry', async () => {
    const user = userEvent.setup();
    render(<RuleSearchInput query="" onApply={jest.fn()} tokens={alertTokens} />);

    await user.click(screen.getByTitle('Search help'));

    for (const token of alertTokens) {
      expect(screen.getByText(token.example)).toBeInTheDocument();
    }
  });

  it('SEARCH-6.5: marks a pending token as "coming soon" in the help popover', async () => {
    const user = userEvent.setup();
    render(<RuleSearchInput query="" onApply={jest.fn()} tokens={alertTokens} />);

    await user.click(screen.getByTitle('Search help'));

    expect(screen.getAllByText(/coming soon/).length).toBeGreaterThan(0);
  });
});
