import { render, screen, waitFor } from 'test/test-utils';

import { TemplateFilters } from './TemplateFilters';

// The variant with the tag and creator filters, as the custom templates tab renders it.
type AllFiltersProps = Extract<React.ComponentProps<typeof TemplateFilters>, { onTagsChange: unknown }>;

function setup(overrides: Partial<AllFiltersProps> = {}) {
  const props: AllFiltersProps = {
    searchQuery: '',
    onSearchChange: jest.fn(),
    tags: [],
    onTagsChange: jest.fn(),
    getTagOptions: jest.fn().mockResolvedValue([{ term: 'observability', count: 2 }]),
    creatorOptions: [
      { value: 'user-1', label: 'Alice' },
      { value: 'user-2', label: 'Bob' },
    ],
    selectedCreators: [],
    onCreatorsChange: jest.fn(),
    sortValue: undefined,
    onSortChange: jest.fn(),
    getSortOptions: jest.fn().mockResolvedValue([
      { label: 'A-Z', value: 'alpha-asc' },
      { label: 'Z-A', value: 'alpha-desc' },
    ]),
    ...overrides,
  };

  const view = render(<TemplateFilters {...props} />);
  return { ...view, props };
}

describe('TemplateFilters', () => {
  it('renders search input, tag filter, creator filter and sort picker', async () => {
    setup();

    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
    expect(screen.getByText(/Filter by tag/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Filter by created by')).toBeInTheDocument();
    // SortPicker mounts lazily via useAsync — wait for it to appear.
    expect(await screen.findByRole('combobox', { name: 'Sort' })).toBeInTheDocument();
  });

  it('reflects the searchQuery prop on the search input', async () => {
    setup({ searchQuery: 'foo' });
    expect(screen.getByDisplayValue('foo')).toBeInTheDocument();
    // Let the SortPicker's useAsync settle to avoid act() warnings.
    await screen.findByRole('combobox', { name: 'Sort' });
  });

  it('calls onSearchChange when the user types in the search input', async () => {
    const { user, props } = setup();
    await user.type(screen.getByPlaceholderText('Search'), 'q');

    expect(props.onSearchChange).toHaveBeenLastCalledWith('q');
  });

  it('invokes getTagOptions when the tag filter is interacted with', async () => {
    const { user, props } = setup();
    await user.click(screen.getByText(/Filter by tag/i));

    await waitFor(() => {
      expect(props.getTagOptions).toHaveBeenCalled();
    });
  });

  it('shows only the search and the sort without the tag and creator filters', async () => {
    render(
      <TemplateFilters
        searchQuery=""
        onSearchChange={jest.fn()}
        sortValue={undefined}
        onSortChange={jest.fn()}
        getSortOptions={jest.fn().mockResolvedValue([{ label: 'A-Z', value: 'alpha-asc' }])}
      />
    );

    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: 'Sort' })).toBeInTheDocument();
    expect(screen.queryByText(/Filter by tag/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Filter by created by')).not.toBeInTheDocument();
  });

  it('invokes getSortOptions when the sort picker mounts', async () => {
    const { props } = setup();
    await waitFor(() => {
      expect(props.getSortOptions).toHaveBeenCalled();
    });
  });
});
