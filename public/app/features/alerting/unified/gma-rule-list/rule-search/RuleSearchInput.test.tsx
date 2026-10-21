import { useState } from 'react';
import { render, screen } from 'test/test-utils';

import { RuleSearchInput } from './RuleSearchInput';
import { alertFilters } from './alertFilters';
import { type FilterDefinition } from './filterDefinitions';
import { getFilterIssues } from './filterIssues';
import { parse } from './parser';
import { serialize } from './serializer';

function PageLikeInput({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  return (
    <>
      <RuleSearchInput
        query={query}
        onApply={(raw) => setQuery(serialize(parse(raw, alertFilters), alertFilters))}
        filters={alertFilters}
      />
      <button onClick={() => setQuery('')}>Clear filters</button>
      <output aria-label="applied query">{query}</output>
    </>
  );
}

describe('RuleSearchInput', () => {
  it('does not apply while typing, only on Enter', async () => {
    const onApply = jest.fn();
    const { user } = render(<RuleSearchInput query="" onApply={onApply} filters={alertFilters} />);

    const input = screen.getByRole('textbox', { name: /search/i });
    await user.type(input, 'cpu');
    expect(onApply).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    expect(onApply).toHaveBeenCalledWith('cpu');
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('applies an empty query as soon as the clear button empties the input', async () => {
    const onApply = jest.fn();
    const { user } = render(<RuleSearchInput query="cpu" onApply={onApply} filters={alertFilters} />);

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onApply).toHaveBeenCalledWith('');
    expect(screen.getByRole('textbox', { name: /search/i })).toHaveValue('');
  });

  it('does not apply when text that was never applied is deleted', async () => {
    const onApply = jest.fn();
    const { user } = render(<RuleSearchInput query="" onApply={onApply} filters={alertFilters} />);

    await user.type(screen.getByRole('textbox', { name: /search/i }), 'cp{Backspace}{Backspace}');

    expect(screen.getByRole('textbox', { name: /search/i })).toHaveValue('');
    expect(onApply).not.toHaveBeenCalled();
  });

  it('does not apply again on Enter when the typed query is already applied', async () => {
    const onApply = jest.fn();
    const { user } = render(<RuleSearchInput query="label:team=api cpu" onApply={onApply} filters={alertFilters} />);

    const input = screen.getByRole('textbox', { name: /search/i });
    await user.tripleClick(input);
    await user.keyboard('cpu label:team=api{Enter}');

    expect(input).toHaveValue('cpu label:team=api');
    expect(onApply).not.toHaveBeenCalled();
  });

  it('applies the draft on blur', async () => {
    const onApply = jest.fn();
    const { user } = render(
      <div>
        <RuleSearchInput query="" onApply={onApply} filters={alertFilters} />
        <button>elsewhere</button>
      </div>
    );

    await user.type(screen.getByRole('textbox', { name: /search/i }), 'cpu');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));

    expect(onApply).toHaveBeenCalledWith('cpu');
  });

  it('resyncs the draft when the applied query changes elsewhere, e.g. Clear filters', async () => {
    const { user } = render(<PageLikeInput initialQuery="cpu" />);
    expect(screen.getByRole('textbox', { name: /search/i })).toHaveValue('cpu');

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.getByRole('textbox', { name: /search/i })).toHaveValue('');
  });

  it('keeps a multi-token query exactly as typed after it is applied', async () => {
    const { user } = render(<PageLikeInput />);
    const typed = 'label:team=api cpu folder:folder-1 foo:bar label:';

    await user.type(screen.getByRole('textbox', { name: /search/i }), `${typed}{Enter}`);

    expect(screen.getByRole('textbox', { name: /search/i })).toHaveValue(typed);
    // Applied query is the canonical form, which reorders tokens.
    expect(screen.getByLabelText('applied query')).toHaveTextContent(
      'folder:folder-1 label:team=api cpu foo:bar label:'
    );
  });

  it('does not apply again on blur when the text is already applied', async () => {
    const onApply = jest.fn();
    const { user } = render(
      <div>
        <RuleSearchInput query="folder:folder-1" onApply={onApply} filters={alertFilters} />
        <button>elsewhere</button>
      </div>
    );

    await user.click(screen.getByRole('textbox', { name: /search/i }));
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));

    expect(onApply).not.toHaveBeenCalled();
  });

  it('the help popover lists an example for every filter and explains that the default policy and not paused cannot be searched yet', async () => {
    const { user } = render(<RuleSearchInput query="" onApply={jest.fn()} filters={alertFilters} />);

    await user.click(screen.getByTitle('Search help'));

    for (const definition of alertFilters) {
      expect(screen.getByText(definition.example)).toBeInTheDocument();
    }
    expect(screen.getByText("Filtering by the default policy isn't available yet.")).toBeInTheDocument();
    expect(screen.getByText("Filtering by not paused isn't available yet.")).toBeInTheDocument();
  });

  it('the help popover names each filter and any values it cannot search yet', async () => {
    const filters: FilterDefinition[] = [
      {
        key: 'folder',
        label: () => 'Folder',
        description: () => 'Folder to search in.',
        example: 'folder:uid',
      },
      {
        key: 'metric',
        label: () => 'Later filter',
        description: () => 'Not built yet.',
        example: 'later:value',
        unavailableValues: [{ value: 'soon', reason: () => 'Needs a backend change.' }],
      },
    ];
    const { user } = render(<RuleSearchInput query="" onApply={jest.fn()} filters={filters} />);

    await user.click(screen.getByTitle('Search help'));

    expect(screen.getByText('Folder')).toBeInTheDocument();
    expect(screen.getByText('Later filter')).toBeInTheDocument();
    expect(screen.getAllByText('Available')).toHaveLength(2);
    expect(screen.getByText('Needs a backend change.')).toBeInTheDocument();
  });

  it('marks the input invalid and names the filters that could not be applied', () => {
    const issues = getFilterIssues(parse('state:error', alertFilters), 'alert');
    render(<RuleSearchInput query="state:error" onApply={jest.fn()} filters={alertFilters} issues={issues} />);

    const input = screen.getByRole('textbox', { name: /search/i });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveValue('state:error');
    expect(input).toHaveAccessibleDescription('Some filters could not be applied: state');
  });

  it('says that search text cannot contain wildcards, next to the filters that could not be applied', () => {
    const issues = getFilterIssues(parse('cpu* state:error', alertFilters), 'alert');
    render(<RuleSearchInput query="cpu* state:error" onApply={jest.fn()} filters={alertFilters} issues={issues} />);

    expect(screen.getByRole('textbox', { name: /search/i })).toHaveAccessibleDescription(
      'Some filters could not be applied: state Search text cannot contain * or %.'
    );
  });
});
