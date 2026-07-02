import { render, screen } from 'test/test-utils';
import { byPlaceholderText, byRole, byTestId } from 'testing-library-selector';

// Configurable mock UserStorage instance shared across tests.
const mockUserStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
};

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  UserStorage: jest.fn().mockImplementation(() => mockUserStorage),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    namespace: 'default',
    bootData: {
      ...jest.requireActual('@grafana/runtime').config.bootData,
      navTree: [],
      user: {
        uid: 'test-user-123',
        id: 123,
        isSignedIn: true,
      },
    },
  },
}));

// Imported after the mocks above: the filter bar instantiates UserStorage at module load.
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { setupMswServer } from '../../mockApi';

import { QualityListFilterBar } from './QualityListFilterBar';

setupMswServer();

const mockSavedSearches = [
  {
    id: '1',
    name: 'CPU rules',
    query: 'rule:cpu',
    isDefault: false,
    createdAt: Date.now() - 1000,
  },
];

const ui = {
  savedSearchesButton: byRole('button', { name: /saved searches/i }),
  saveButton: byRole('button', { name: /save current search/i }),
  saveConfirmButton: byRole('button', { name: /save$/i }),
  saveInput: byPlaceholderText(/enter a name/i),
  appliedQuery: byTestId('applied-query'),
  searchInput: byTestId('quality-search-input'),
};

/** Renders the filter bar alongside a readout of the active rules search query. */
function FilterBarHarness() {
  const { searchQuery } = useRulesFilter();

  return (
    <>
      <QualityListFilterBar />
      <div data-testid="applied-query">{searchQuery}</div>
    </>
  );
}

function renderBar(initialQueryString = '') {
  const url = `/alerting/list/quality${initialQueryString ? `?${initialQueryString}` : ''}`;
  return render(<FilterBarHarness />, { historyOptions: { initialEntries: [url] } });
}

describe('QualityListFilterBar saved searches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    mockUserStorage.getItem.mockResolvedValue(null);
    mockUserStorage.setItem.mockResolvedValue(undefined);
  });

  it('renders the saved searches button', async () => {
    renderBar();

    expect(await ui.savedSearchesButton.find()).toBeInTheDocument();
  });

  it('loads and displays saved searches from storage', async () => {
    mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

    const { user } = renderBar();

    await user.click(await ui.savedSearchesButton.find());

    expect(await screen.findByRole('link', { name: 'CPU rules' })).toBeInTheDocument();
  });

  it('applies a saved search to the active filter query', async () => {
    mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

    const { user } = renderBar();

    await user.click(await ui.savedSearchesButton.find());
    await user.click(await screen.findByRole('link', { name: 'CPU rules' }));

    expect(await ui.appliedQuery.find()).toHaveTextContent('rule:cpu');
  });

  it('saves the current state as a composite query', async () => {
    // Start with a rules query and an active severity filter in the URL.
    const { user } = renderBar('search=rule%3Acpu&qualitySeverity=high');

    await user.click(await ui.savedSearchesButton.find());
    await user.click(await ui.saveButton.find());
    await user.type(await ui.saveInput.find(), 'My CPU search');
    await user.click(ui.saveConfirmButton.get());

    // The saved query captures both the rules search and the sidebar severity selection.
    expect(mockUserStorage.setItem).toHaveBeenCalledWith(
      'alertQualitySavedSearches',
      expect.stringContaining('search=rule%3Acpu')
    );
    expect(mockUserStorage.setItem).toHaveBeenCalledWith(
      'alertQualitySavedSearches',
      expect.stringContaining('qualitySeverity=high')
    );
    expect(mockUserStorage.setItem).toHaveBeenCalledWith(
      'alertQualitySavedSearches',
      expect.stringContaining('"name":"My CPU search"')
    );
  });

  it('reflects the active rules query in the search input', async () => {
    renderBar('search=rule%3Acpu');

    expect(await ui.searchInput.find()).toHaveValue('rule:cpu');
  });
});
