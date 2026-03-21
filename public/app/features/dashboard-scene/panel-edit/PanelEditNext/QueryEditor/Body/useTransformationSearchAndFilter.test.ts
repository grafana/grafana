import { renderHook, act } from '@testing-library/react';

import { standardTransformersRegistry, TransformerCategory } from '@grafana/data';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { useTransformationSearchAndFilter } from './useTransformationSearchAndFilter';

describe('useTransformationSearchAndFilter', () => {
  beforeAll(() => {
    standardTransformersRegistry.setInit(getStandardTransformers);
  });

  const mockOnSelect = jest.fn();

  const createKeyboardEvent = (key: string): React.KeyboardEvent<HTMLInputElement> =>
    ({
      key,
      stopPropagation: jest.fn(),
    }) as unknown as React.KeyboardEvent<HTMLInputElement>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with default state showing all transformations', () => {
    const { result } = renderHook(() => useTransformationSearchAndFilter(mockOnSelect));

    expect(result.current.search).toBe('');
    expect(result.current.selectedFilter).toBeNull();

    // Should return all transformations from the registry
    const allTransformers = standardTransformersRegistry.list();
    expect(result.current.filteredTransformations.length).toBe(allTransformers.length);
  });

  describe('filtering', () => {
    it('narrows results when searching', () => {
      const { result } = renderHook(() => useTransformationSearchAndFilter(mockOnSelect));

      const allCount = result.current.filteredTransformations.length;

      act(() => result.current.setSearch('organize'));

      const filteredCount = result.current.filteredTransformations.length;

      // Search should reduce the number of results
      expect(filteredCount).toBeLessThan(allCount);
      expect(filteredCount).toBeGreaterThan(0);

      // All results should match the search term
      result.current.filteredTransformations.forEach(({ name, description }) => {
        const matchesSearch =
          name.toLowerCase().includes('organize') || description?.toLowerCase().includes('organize');
        expect(matchesSearch).toBe(true);
      });
    });

    it('returns no results for non-existent search term', () => {
      const { result } = renderHook(() => useTransformationSearchAndFilter(mockOnSelect));

      act(() => result.current.setSearch('zzzznonexistent12345'));

      expect(result.current.filteredTransformations).toHaveLength(0);
    });

    it('clears filter when search is cleared', () => {
      const { result } = renderHook(() => useTransformationSearchAndFilter(mockOnSelect));

      const allCount = result.current.filteredTransformations.length;

      // Apply search
      act(() => result.current.setSearch('organize'));
      expect(result.current.filteredTransformations.length).toBeLessThan(allCount);

      // Clear search
      act(() => result.current.setSearch(''));
      expect(result.current.filteredTransformations.length).toBe(allCount);
    });

    it('filters by category when user clicks filter pill', () => {
      const { result } = renderHook(() => useTransformationSearchAndFilter(mockOnSelect));

      const allCount = result.current.filteredTransformations.length;

      act(() => result.current.setSelectedFilter(TransformerCategory.Filter));

      const filteredCount = result.current.filteredTransformations.length;

      // Category filter should reduce results
      expect(filteredCount).toBeLessThan(allCount);
      expect(filteredCount).toBeGreaterThan(0);

      // All results should belong to the selected category
      result.current.filteredTransformations.forEach((t) => {
        expect(t.categories?.has(TransformerCategory.Filter)).toBe(true);
      });
    });

    it('resets to all transformations when "View all" is clicked', () => {
      const { result } = renderHook(() => useTransformationSearchAndFilter(mockOnSelect));

      const allCount = result.current.filteredTransformations.length;

      // Apply category filter
      act(() => result.current.setSelectedFilter(TransformerCategory.Filter));
      expect(result.current.filteredTransformations.length).toBeLessThan(allCount);

      // Click "View all" (sets filter to null)
      act(() => result.current.setSelectedFilter(null));
      expect(result.current.filteredTransformations.length).toBe(allCount);
    });

    it('combines search and category filters together', () => {
      const { result } = renderHook(() => useTransformationSearchAndFilter(mockOnSelect));

      const allCount = result.current.filteredTransformations.length;

      // Apply both filters
      act(() => {
        result.current.setSelectedFilter(TransformerCategory.Filter);
        result.current.setSearch('value');
      });

      const filtered = result.current.filteredTransformations;

      // Should be more restrictive than either filter alone
      expect(filtered.length).toBeLessThan(allCount);

      // All results must match both criteria
      filtered.forEach(({ name, description, categories }) => {
        expect(categories?.has(TransformerCategory.Filter)).toBe(true);
        const matchesSearch = name.toLowerCase().includes('value') || description?.toLowerCase().includes('value');
        expect(matchesSearch).toBe(true);
      });
    });
  });

  describe('keyboard shortcuts', () => {
    it('adds first transformation when user presses Enter after searching', () => {
      const { result } = renderHook(() => useTransformationSearchAndFilter(mockOnSelect));

      act(() => result.current.setSearch('organize'));

      const firstResultId = result.current.filteredTransformations[0].id;
      const mockEvent = createKeyboardEvent('Enter');

      act(() => result.current.onSearchKeyDown(mockEvent));

      expect(mockOnSelect).toHaveBeenCalledWith(firstResultId);
    });

    it('does nothing when user presses Enter with empty search', () => {
      const { result } = renderHook(() => useTransformationSearchAndFilter(mockOnSelect));
      const mockEvent = createKeyboardEvent('Enter');

      act(() => result.current.onSearchKeyDown(mockEvent));

      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it('does nothing when user presses Enter with no matching results', () => {
      const { result } = renderHook(() => useTransformationSearchAndFilter(mockOnSelect));

      act(() => result.current.setSearch('nonexistentransformation12345'));

      const mockEvent = createKeyboardEvent('Enter');

      act(() => result.current.onSearchKeyDown(mockEvent));

      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it('clears search when user presses Escape', () => {
      const { result } = renderHook(() => useTransformationSearchAndFilter(mockOnSelect));

      act(() => result.current.setSearch('organize'));
      expect(result.current.search).toBe('organize');

      const mockEvent = createKeyboardEvent('Escape');

      act(() => result.current.onSearchKeyDown(mockEvent));

      expect(result.current.search).toBe('');
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });

    it('ignores other keyboard keys', () => {
      const { result } = renderHook(() => useTransformationSearchAndFilter(mockOnSelect));

      act(() => result.current.setSearch('organize'));

      const mockEvent = createKeyboardEvent('ArrowDown');

      act(() => result.current.onSearchKeyDown(mockEvent));

      // Should not clear search or select transformation
      expect(result.current.search).toBe('organize');
      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });
});
