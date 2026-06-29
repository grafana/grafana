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

// Imported after the mocks above: QualityFilter instantiates UserStorage at module load.
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { setupMswServer } from '../../mockApi';

import { QualityFilter } from './QualityFilter';

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
};

/**
 * Renders the filter alongside a readout of the active search query so we can assert
 * that applying a saved search updates the shared (URL-backed) filter state.
 */
function FilterHarness() {
  const { searchQuery } = useRulesFilter();
  return (
    <>
      <QualityFilter />
      <div data-testid="applied-query">{searchQuery}</div>
    </>
  );
}

function renderFilter(initialSearch = '') {
  const url = `/alerting/list/quality${initialSearch ? `?search=${encodeURIComponent(initialSearch)}` : ''}`;
  return render(<FilterHarness />, { historyOptions: { initialEntries: [url] } });
}

describe('QualityFilter saved searches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    mockUserStorage.getItem.mockResolvedValue(null);
    mockUserStorage.setItem.mockResolvedValue(undefined);
  });

  it('renders the saved searches button', async () => {
    renderFilter();

    expect(await ui.savedSearchesButton.find()).toBeInTheDocument();
  });

  it('loads and displays saved searches from storage', async () => {
    mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

    const { user } = renderFilter();

    await user.click(await ui.savedSearchesButton.find());

    expect(await screen.findByRole('link', { name: 'CPU rules' })).toBeInTheDocument();
  });

  it('applies a saved search to the active filter query', async () => {
    mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

    const { user } = renderFilter();

    await user.click(await ui.savedSearchesButton.find());
    await user.click(await screen.findByRole('link', { name: 'CPU rules' }));

    expect(await ui.appliedQuery.find()).toHaveTextContent('rule:cpu');
  });

  it('saves the current search query under the provided name', async () => {
    const { user } = renderFilter('rule:cpu');

    await user.click(await ui.savedSearchesButton.find());
    await user.click(await ui.saveButton.find());
    await user.type(await ui.saveInput.find(), 'My CPU search');
    await user.click(ui.saveConfirmButton.get());

    expect(mockUserStorage.setItem).toHaveBeenCalledWith(
      'alertQualitySavedSearches',
      expect.stringContaining('"query":"rule:cpu"')
    );
    expect(mockUserStorage.setItem).toHaveBeenCalledWith(
      'alertQualitySavedSearches',
      expect.stringContaining('"name":"My CPU search"')
    );
  });
});
