import { act } from '@testing-library/react';
import { render, screen } from 'test/test-utils';

import { useDataSourceInstanceList } from '@grafana/runtime';

import RuleListV1 from './RuleList.v1';

const useRulesFilterMock = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useDataSourceInstanceList: jest.fn(),
}));

jest.mock('app/types/store', () => ({
  ...jest.requireActual('app/types/store'),
  useDispatch: () => jest.fn(),
}));

jest.mock('../Analytics', () => ({
  trackRuleListNavigation: jest.fn(() => Promise.resolve()),
}));
jest.mock('../components/import-to-gma/ImportToGMABanner', () => ({
  ImportToGMABanner: () => null,
}));
jest.mock('../components/import-to-gma/useShowImportToGMARulesBanner', () => ({
  useShowImportToGMARulesBanner: () => false,
}));
jest.mock('../components/rules/Filter/RulesFilter.v1', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../components/rules/RuleListGroupView', () => ({
  RuleListGroupView: () => null,
}));
jest.mock('../hooks/useFilteredRules', () => ({
  ...jest.requireActual('../hooks/useFilteredRules'),
  useRulesFilter: (...args: unknown[]) => useRulesFilterMock(...args),
}));
jest.mock('../hooks/useUnifiedAlertingSelector', () => ({
  useUnifiedAlertingSelector: (selector: (state: unknown) => unknown) => selector({ promRules: {}, rulerRules: {} }),
}));
jest.mock('../navigation/useAlertRulesNav', () => ({
  useAlertRulesNav: () => ({ navId: 'alert-rules', pageNav: {} }),
}));
jest.mock('../state/actions', () => ({
  fetchAllPromAndRulerRulesAction: jest.fn(),
  fetchAllPromRulesAction: jest.fn(),
  fetchRulerRulesAction: jest.fn(),
}));
const dataSourceListMock = jest.mocked(useDataSourceInstanceList);

const activeFilter = {
  dataSourceNames: ['Loki'],
  labels: [],
  freeFormWords: [],
};

const noDataSourceFilter = {
  dataSourceNames: [],
  labels: [],
  freeFormWords: [],
};

function setFilterState(filterState: typeof activeFilter) {
  useRulesFilterMock.mockReturnValue({
    filterState,
    hasActiveFilters: filterState.dataSourceNames.length > 0,
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  dataSourceListMock.mockReturnValue({ items: [], isLoading: true, error: undefined });
  setFilterState(activeFilter);
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('RuleListV1 datasource loading', () => {
  it('does not show the skeleton while a datasource lookup finishes quickly', async () => {
    render(<RuleListV1 />);

    await act(() => jest.advanceTimersByTimeAsync(299));

    expect(screen.queryByLabelText('Loading alert rules')).not.toBeInTheDocument();
  });

  it('shows the skeleton when datasource loading exceeds the delay', async () => {
    render(<RuleListV1 />);

    await act(() => jest.advanceTimersByTimeAsync(300));

    expect(screen.getByLabelText('Loading alert rules')).toBeInTheDocument();
  });

  it('does not show the skeleton without an active datasource filter', async () => {
    setFilterState(noDataSourceFilter);
    render(<RuleListV1 />);

    await act(() => jest.advanceTimersByTimeAsync(300));

    expect(screen.queryByLabelText('Loading alert rules')).not.toBeInTheDocument();
  });
});
