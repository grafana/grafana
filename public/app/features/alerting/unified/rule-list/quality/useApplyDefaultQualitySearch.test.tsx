import { getWrapper, renderHook, waitFor } from 'test/test-utils';

import { type SavedSearch } from '../../components/saved-searches/savedSearchesSchema';
import { useRulesFilter } from '../../hooks/useFilteredRules';

import { useApplyDefaultQualitySearch } from './useApplyDefaultQualitySearch';

const mockLoadDefault = jest.fn();
const mockTrackAutoApply = jest.fn();

jest.mock('./useQualitySavedSearches', () => ({
  loadDefaultQualitySearch: () => mockLoadDefault(),
  trackQualitySavedSearchAutoApply: () => mockTrackAutoApply(),
}));

const defaultSearch: SavedSearch = {
  id: '1',
  name: 'CPU rules',
  query: 'rule:cpu',
  isDefault: true,
  createdAt: Date.now(),
};

// Combine both hooks so we can observe how the auto-apply hook mutates the shared filter state.
function useHarness() {
  const apply = useApplyDefaultQualitySearch();
  const filter = useRulesFilter();
  return { apply, filter };
}

function renderHarness(initialSearch = '') {
  const url = `/alerting/list/quality${initialSearch ? `?search=${encodeURIComponent(initialSearch)}` : ''}`;
  const wrapper = getWrapper({ renderWithRouter: true, historyOptions: { initialEntries: [url] } });
  return renderHook(() => useHarness(), { wrapper });
}

describe('useApplyDefaultQualitySearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  it('applies the default saved search on first visit when no filters are active', async () => {
    mockLoadDefault.mockResolvedValue(defaultSearch);

    const { result } = renderHarness();

    await waitFor(() => {
      expect(result.current.filter.searchQuery).toContain('rule:cpu');
    });
    expect(mockTrackAutoApply).toHaveBeenCalledTimes(1);
  });

  it('does not apply the default search when filters are already active', async () => {
    mockLoadDefault.mockResolvedValue(defaultSearch);

    const { result } = renderHarness('rule:memory');

    await waitFor(() => {
      expect(result.current.apply.isApplying).toBe(false);
    });

    expect(result.current.filter.searchQuery).toContain('rule:memory');
    expect(result.current.filter.searchQuery).not.toContain('rule:cpu');
    expect(mockTrackAutoApply).not.toHaveBeenCalled();
  });

  it('does not apply the default search on subsequent visits in the same session', async () => {
    mockLoadDefault.mockResolvedValue(defaultSearch);
    sessionStorage.setItem('grafana.alerting.qualityList.visited', 'true');

    const { result } = renderHarness();

    await waitFor(() => {
      expect(result.current.apply.isApplying).toBe(false);
    });

    expect(result.current.filter.searchQuery).toBe('');
    expect(mockTrackAutoApply).not.toHaveBeenCalled();
  });
});
