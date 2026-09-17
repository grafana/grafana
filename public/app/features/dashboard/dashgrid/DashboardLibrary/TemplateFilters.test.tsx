import { render, screen, waitFor } from 'test/test-utils';

import { TemplateFilters } from './TemplateFilters';

function setup(overrides: Partial<React.ComponentProps<typeof TemplateFilters>> = {}) {
  const props: React.ComponentProps<typeof TemplateFilters> = {
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

  it('invokes getSortOptions when the sort picker mounts', async () => {
    const { props } = setup();
    await waitFor(() => {
      expect(props.getSortOptions).toHaveBeenCalled();
    });
  });
});
