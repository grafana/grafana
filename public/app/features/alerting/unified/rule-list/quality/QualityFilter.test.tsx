import { useState } from 'react';
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
import { Annotation } from '../../utils/constants';

import { QualityFilter } from './QualityFilter';
import { type FindingTypeCounts, type FindingTypeFilterValue, type SeverityFilterValue } from './qualityFindingFilters';

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
  severityReadout: byTestId('severity'),
  findingTypeReadout: byTestId('finding-type'),
  highSeverityRadio: byRole('radio', { name: 'High' }),
  mediumSeverityRadio: byRole('radio', { name: 'Medium' }),
  summaryFindingButton: byRole('button', { name: /missing Summary/i }),
  descriptionFindingButton: byRole('button', { name: /missing Description/i }),
  runbookFindingButton: byRole('button', { name: /missing Runbook URL/i }),
  clearButton: byRole('button', { name: /clear filters/i }),
};

const findingCounts: FindingTypeCounts = {
  [Annotation.summary]: 3,
  [Annotation.description]: 2,
  [Annotation.runbookURL]: 1,
};

/**
 * Renders the filter alongside readouts of the active search query and the locally-owned
 * severity / finding-type filters, so we can assert how interactions update each one.
 */
function FilterHarness() {
  const { searchQuery } = useRulesFilter();
  const [severity, setSeverity] = useState<SeverityFilterValue>('all');
  const [findingType, setFindingType] = useState<FindingTypeFilterValue>('all');

  return (
    <>
      <QualityFilter
        severity={severity}
        onSeverityChange={setSeverity}
        findingType={findingType}
        onFindingTypeChange={setFindingType}
        findingCounts={findingCounts}
        onClearExtraFilters={() => {
          setSeverity('all');
          setFindingType('all');
        }}
      />
      <div data-testid="applied-query">{searchQuery}</div>
      <div data-testid="severity">{severity}</div>
      <div data-testid="finding-type">{findingType}</div>
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

describe('QualityFilter severity and finding-type filters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    mockUserStorage.getItem.mockResolvedValue(null);
    mockUserStorage.setItem.mockResolvedValue(undefined);
  });

  it('updates the severity filter when a severity is selected', async () => {
    const { user } = renderFilter();

    expect(await ui.severityReadout.find()).toHaveTextContent('all');

    await user.click(ui.highSeverityRadio.get());

    expect(ui.severityReadout.get()).toHaveTextContent('high');
  });

  it('renders a finding-type button per type with its count', async () => {
    renderFilter();

    expect(await ui.summaryFindingButton.find()).toHaveTextContent('3 missing Summary');
    expect(ui.descriptionFindingButton.get()).toHaveTextContent('2 missing Description');
    expect(ui.runbookFindingButton.get()).toHaveTextContent('1 missing Runbook URL');
  });

  it('toggles a finding-type filter on and off', async () => {
    const { user } = renderFilter();

    expect(await ui.findingTypeReadout.find()).toHaveTextContent('all');

    await user.click(ui.descriptionFindingButton.get());
    expect(ui.findingTypeReadout.get()).toHaveTextContent(Annotation.description);

    // Clicking the active finding type again clears back to "all".
    await user.click(ui.descriptionFindingButton.get());
    expect(ui.findingTypeReadout.get()).toHaveTextContent('all');
  });

  it('shows Clear filters for the extra filters and resets them', async () => {
    const { user } = renderFilter();

    // No active filters initially, so the clear button is hidden.
    expect(ui.clearButton.query()).not.toBeInTheDocument();

    await user.click(ui.mediumSeverityRadio.get());
    await user.click(ui.summaryFindingButton.get());

    expect(ui.severityReadout.get()).toHaveTextContent('medium');
    expect(ui.findingTypeReadout.get()).toHaveTextContent(Annotation.summary);

    await user.click(await ui.clearButton.find());

    expect(ui.severityReadout.get()).toHaveTextContent('all');
    expect(ui.findingTypeReadout.get()).toHaveTextContent('all');
  });
});
