import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { render, screen } from 'test/test-utils';

import { RuleSearchInput } from './RuleSearchInput';
import { alertTokens } from './alertTokens';
import { getCriteriaIssues } from './criteriaIssues';
import { parse } from './parser';
import { serialize } from './serializer';
import { type TokenDefinition } from './tokens';

function PageLikeInput({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  return (
    <>
      <RuleSearchInput
        query={query}
        onApply={(raw) => setQuery(serialize(parse(raw, alertTokens)))}
        tokens={alertTokens}
        debounceMs={0}
      />
      <button onClick={() => setQuery('')}>Clear filters</button>
      <output aria-label="applied query">{query}</output>
    </>
  );
}

describe('RuleSearchInput', () => {
  it('applies a valid edit after the debounce, not on every keystroke', async () => {
    // Fake timers: with real ones, userEvent's per-keystroke delay can exceed the debounce under
    // load and apply a partial value. advanceTimers keeps userEvent on the fake clock.
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

  it('Enter applies immediately, without waiting for the debounce', async () => {
    const onApply = jest.fn();
    const { user } = render(<RuleSearchInput query="" onApply={onApply} tokens={alertTokens} debounceMs={10_000} />);

    const input = screen.getByRole('textbox', { name: /search/i });
    await user.type(input, 'cpu{Enter}');

    expect(onApply).toHaveBeenCalledWith('cpu');
  });

  it('blur applies the current draft immediately', async () => {
    const onApply = jest.fn();
    const { user } = render(
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

  it('keeps a multi-token query exactly as typed after it is applied', async () => {
    const { user } = render(<PageLikeInput />);
    const typed = 'label:team=api cpu namespace:folder-1 foo:bar label:';

    await user.type(screen.getByRole('textbox', { name: /search/i }), `${typed}{Enter}`);

    expect(screen.getByRole('textbox', { name: /search/i })).toHaveValue(typed);
    // Applied query is the canonical form, which reorders tokens.
    expect(screen.getByLabelText('applied query')).toHaveTextContent(
      'namespace:folder-1 label:team=api foo:bar label: cpu'
    );
  });

  it('does not apply a half-typed filter while typing, only on Enter', async () => {
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

  it('does not apply again on blur when the text is already applied', async () => {
    const onApply = jest.fn();
    const { user } = render(
      <div>
        <RuleSearchInput query="namespace:folder-1" onApply={onApply} tokens={alertTokens} />
        <button>elsewhere</button>
      </div>
    );

    await user.click(screen.getByRole('textbox', { name: /search/i }));
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));

    expect(onApply).not.toHaveBeenCalled();
  });

  it('the help popover lists an example for every token and explains that the default policy cannot be searched yet', async () => {
    const { user } = render(<RuleSearchInput query="" onApply={jest.fn()} tokens={alertTokens} />);

    await user.click(screen.getByTitle('Search help'));

    for (const token of alertTokens) {
      expect(screen.getByText(token.example)).toBeInTheDocument();
    }
    expect(screen.getByText("Filtering by the default policy isn't available yet.")).toBeInTheDocument();
  });

  it('the help popover names each filter and any values it cannot search yet', async () => {
    const tokens: TokenDefinition[] = [
      {
        key: 'folder',
        label: () => 'Folder',
        description: () => 'Folder to search in.',
        example: 'folder:uid',
      },
      {
        key: 'later',
        label: () => 'Later filter',
        description: () => 'Not built yet.',
        example: 'later:value',
        unavailableValues: [{ value: 'soon', reason: () => 'Needs a backend change.' }],
      },
    ];
    const { user } = render(<RuleSearchInput query="" onApply={jest.fn()} tokens={tokens} />);

    await user.click(screen.getByTitle('Search help'));

    expect(screen.getByText('Folder')).toBeInTheDocument();
    expect(screen.getByText('Later filter')).toBeInTheDocument();
    expect(screen.getAllByText('Available')).toHaveLength(2);
    expect(screen.getByText('Needs a backend change.')).toBeInTheDocument();
  });

  it('marks the input invalid, names the filters that failed and says what would work instead', () => {
    const issues = getCriteriaIssues(parse('state:error', alertTokens), 'alert');
    render(<RuleSearchInput query="state:error" onApply={jest.fn()} tokens={alertTokens} issues={issues} />);

    const input = screen.getByRole('textbox', { name: /search/i });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveValue('state:error');
    expect(screen.getByText('Some filters could not be applied: state')).toBeInTheDocument();
    expect(screen.getByText('state:error is not a valid filter. Use health:error.')).toBeInTheDocument();
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Use health:error.'));
  });

  it('shows the label suffix beside the label without changing the input name', () => {
    render(
      <RuleSearchInput query="" onApply={jest.fn()} tokens={alertTokens} labelSuffix={<span>applied name</span>} />
    );

    expect(screen.getByText('applied name')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /search/i })).not.toHaveAccessibleName(/applied name/);
  });
});
