import { render, screen, waitFor } from 'test/test-utils';
import { byTestId } from 'testing-library-selector';

import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { alertRuleHitFactory, recordingRuleHitFactory } from '../mocks/server/entities/k8s/ruleSearchHits';
import { rulesSearchHandlerFor } from '../mocks/server/handlers/k8s/rulesSearch.k8s';

import RuleListPage from './RuleList.v3';
import { loadDefaultSavedSearch } from './filter/useSavedSearches';

jest.mock('@grafana/assistant', () => ({
  useAssistant: () => ({ isAvailable: false, openAssistant: jest.fn() }),
}));

jest.mock('./filter/useSavedSearches', () => ({
  ...jest.requireActual('./filter/useSavedSearches'),
  loadDefaultSavedSearch: jest.fn(),
  useSavedSearches: jest.fn(() => ({
    savedSearches: [],
    isLoading: false,
    saveSearch: jest.fn(),
    renameSearch: jest.fn(),
    deleteSearch: jest.fn(),
    setDefaultSearch: jest.fn(),
  })),
}));

const loadDefaultSavedSearchMock = loadDefaultSavedSearch as jest.MockedFunction<typeof loadDefaultSavedSearch>;

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

grantUserPermissions([AccessControlAction.AlertingRuleRead]);

const server = setupMswServer();

const ui = {
  searchInput: byTestId('search-query-input'),
};

beforeEach(() => {
  loadDefaultSavedSearchMock.mockResolvedValue(null);
  sessionStorage.clear();
  sessionStorage.setItem('grafana.alerting.ruleList.visited', 'true');

  server.use(
    rulesSearchHandlerFor([
      alertRuleHitFactory.build({ name: 'alert-uid', title: 'CPU usage high' }),
      recordingRuleHitFactory.build({ name: 'recording-uid', title: 'Memory usage average' }),
    ])
  );
});

describe('RuleListPage v3', () => {
  it('renders the search input and the flat list', async () => {
    render(<RuleListPage />);

    expect(await screen.findByText('CPU usage high')).toBeInTheDocument();
    expect(screen.getByText('Memory usage average')).toBeInTheDocument();
    expect(ui.searchInput.get()).toBeInTheDocument();
  });

  it('applies a URL search query server-side (type filter)', async () => {
    render(<RuleListPage />, { historyOptions: { initialEntries: ['/?search=type:recording'] } });

    expect(await screen.findByText('Memory usage average')).toBeInTheDocument();
    expect(screen.queryByText('CPU usage high')).not.toBeInTheDocument();
  });

  it('filters the list server-side as the user types a query', async () => {
    const { user } = render(<RuleListPage />);

    expect(await screen.findByText('CPU usage high')).toBeInTheDocument();

    await user.type(ui.searchInput.get(), 'rule:memory{Enter}');

    await waitFor(() => expect(screen.queryByText('CPU usage high')).not.toBeInTheDocument());
    expect(screen.getByText('Memory usage average')).toBeInTheDocument();
  });
});
