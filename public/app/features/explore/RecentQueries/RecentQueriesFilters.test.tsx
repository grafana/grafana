import { within } from '@testing-library/react';
import { render, screen } from 'test/test-utils';

import { SortOrder } from 'app/core/utils/richHistoryTypes';

import { RecentQueriesFilters } from './RecentQueriesFilters';
import { type RecentQueriesFilterState } from './useRecentQueriesData';

// Mock complex controls so tests can trigger onChange without deep UI interaction.
jest.mock('app/core/components/Select/SortPicker', () => ({
  SortPicker: jest.fn(({ onChange }) => (
    <button data-testid="sort-picker" onClick={() => onChange({ value: SortOrder.Descending, label: 'Sort Newest' })} />
  )),
}));

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  MultiCombobox: jest.fn(({ id, onChange }) => (
    <button data-testid={`multi-combobox-${id}`} onClick={() => onChange([{ value: 'test-val' }])} />
  )),
}));

const mockOnAnalyticsEvent = jest.fn();
const mockSetFilters = jest.fn();
const mockOnClear = jest.fn();

const defaultFilters: RecentQueriesFilterState = {
  searchQuery: '',
  datasourceFilters: [],
  sortingOption: {},
  showStarredOnly: false,
  rememberFilters: false,
};

const defaultProps = {
  filters: defaultFilters,
  setFilters: mockSetFilters,
  availableDatasources: ['prometheus', 'loki'],
  onClear: mockOnClear,
  onAnalyticsEvent: mockOnAnalyticsEvent,
};

describe('RecentQueriesFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the Filters region landmark', () => {
    render(<RecentQueriesFilters {...defaultProps} />);
    expect(screen.getByRole('region', { name: 'Filters' })).toBeInTheDocument();
  });

  it('renders the visible Filters header and Clear link', () => {
    render(<RecentQueriesFilters {...defaultProps} />);
    const filtersRegion = screen.getByRole('region', { name: 'Filters' });
    expect(within(filtersRegion).getByText('Filters')).toBeInTheDocument();
    expect(within(filtersRegion).getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  it('renders all section labels (no Author or Tags)', () => {
    render(<RecentQueriesFilters {...defaultProps} />);
    const filtersRegion = screen.getByRole('region', { name: 'Filters' });
    expect(within(filtersRegion).getByText('Search')).toBeInTheDocument();
    expect(within(filtersRegion).getByText('Data source name')).toBeInTheDocument();
    expect(within(filtersRegion).getByText('Sort')).toBeInTheDocument();
    expect(within(filtersRegion).getByText('Remember filters')).toBeInTheDocument();

    // These should NOT be present (unlike SavedQueriesFilters)
    expect(within(filtersRegion).queryByText('Author')).not.toBeInTheDocument();
    expect(within(filtersRegion).queryByText('Tags')).not.toBeInTheDocument();
  });

  it('shows the starred filter when showStarredFilter is true', () => {
    render(<RecentQueriesFilters {...defaultProps} showStarredFilter />);
    expect(screen.getByRole('radiogroup', { name: 'Starred queries' })).toBeInTheDocument();
  });

  it('hides the starred filter by default', () => {
    render(<RecentQueriesFilters {...defaultProps} />);
    expect(screen.queryByRole('radiogroup', { name: 'Starred queries' })).not.toBeInTheDocument();
  });

  it('calls onClear when the Clear link is clicked', async () => {
    const { user } = render(<RecentQueriesFilters {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(mockOnClear).toHaveBeenCalledTimes(1);
  });

  it('calls setFilters with searchQuery when search input changes', async () => {
    const { user } = render(<RecentQueriesFilters {...defaultProps} />);
    await user.type(screen.getByPlaceholderText('Search by...'), 'h');
    expect(mockSetFilters).toHaveBeenCalledWith({ searchQuery: 'h' });
  });

  it('passes regex special characters through unescaped', async () => {
    const { user } = render(<RecentQueriesFilters {...defaultProps} />);
    await user.type(screen.getByPlaceholderText('Search by...'), '-');
    expect(mockSetFilters).toHaveBeenCalledWith({ searchQuery: '-' });
  });

  it('calls setFilters with datasourceFilters when datasource filter changes', async () => {
    const { user } = render(<RecentQueriesFilters {...defaultProps} />);
    await user.click(screen.getByTestId('multi-combobox-recent-queries-datasource-filter'));
    expect(mockSetFilters).toHaveBeenCalledWith({ datasourceFilters: ['test-val'] });
  });

  it('calls setFilters with sortingOption when sort changes', async () => {
    const { user } = render(<RecentQueriesFilters {...defaultProps} />);
    await user.click(screen.getByTestId('sort-picker'));
    expect(mockSetFilters).toHaveBeenCalledWith({
      sortingOption: { value: SortOrder.Descending, label: 'Sort Newest' },
    });
  });

  it('calls setFilters with rememberFilters true when toggle is clicked', async () => {
    const { user } = render(<RecentQueriesFilters {...defaultProps} />);
    await user.click(screen.getByLabelText('Remember filters'));
    expect(mockSetFilters).toHaveBeenCalledWith({ rememberFilters: true });
  });

  it('disables the search input when disabled prop is true', () => {
    render(<RecentQueriesFilters {...defaultProps} disabled />);
    expect(screen.getByPlaceholderText('Search by...')).toBeDisabled();
  });

  it('disables the remember-filters toggle when disabled prop is true', () => {
    render(<RecentQueriesFilters {...defaultProps} disabled />);
    expect(screen.getByRole('switch', { name: 'Remember filters' })).toBeDisabled();
  });

  it('disables the Clear button when disabled prop is true', () => {
    render(<RecentQueriesFilters {...defaultProps} disabled />);
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });

  it('fires analytics event when search bar is focused', async () => {
    const { user } = render(<RecentQueriesFilters {...defaultProps} />);
    await user.click(screen.getByPlaceholderText('Search by...'));
    expect(mockOnAnalyticsEvent).toHaveBeenCalledWith('searchBarFocused');
  });

  it('fires analytics event when datasource filter changes', async () => {
    const { user } = render(<RecentQueriesFilters {...defaultProps} />);
    await user.click(screen.getByTestId('multi-combobox-recent-queries-datasource-filter'));
    expect(mockOnAnalyticsEvent).toHaveBeenCalledWith('dataSourceFilterChanged');
  });

  it('fires analytics event when sort option changes', async () => {
    const { user } = render(<RecentQueriesFilters {...defaultProps} />);
    await user.click(screen.getByTestId('sort-picker'));
    expect(mockOnAnalyticsEvent).toHaveBeenCalledWith('sortingOptionChanged', { value: SortOrder.Descending });
  });

  it('fires analytics event when remember-filters is toggled', async () => {
    const { user } = render(<RecentQueriesFilters {...defaultProps} />);
    await user.click(screen.getByLabelText('Remember filters'));
    expect(mockOnAnalyticsEvent).toHaveBeenCalledWith('rememberFiltersToggled', { rememberFilters: true });
  });

  it('does not crash when onAnalyticsEvent is not provided', async () => {
    const { user } = render(<RecentQueriesFilters {...defaultProps} onAnalyticsEvent={undefined} />);
    await user.type(screen.getByPlaceholderText('Search by...'), 'x');
    expect(mockSetFilters).toHaveBeenCalled();
  });
});
