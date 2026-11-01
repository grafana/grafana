import { render, screen, waitForElementToBeRemoved, within } from 'test/test-utils';

import { setPluginComponentsHook, setPluginLinksHook, setReturnToPreviousHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { installControllableIntersectionObserver } from '../mocks/intersectionObserver';
import { setPrometheusRules } from '../mocks/server/configure';
import { alertingFactory } from '../mocks/server/db';
import { type RulesFilter } from '../search/rulesSearchParser';
import { setupPrometheusAlertingPlugin } from '../testSetup/prometheusAlertingPlugin';
import { SupportedPlugin } from '../types/pluginBridges';

import { FilterView } from './FilterView';

jest.mock('@grafana/assistant', () => ({
  useAssistant: () => ({ isAvailable: false, openAssistant: jest.fn() }),
}));

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));
const returnToPrevious = jest.fn();
setReturnToPreviousHook(() => returnToPrevious);

grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);

setupMswServer();

const mimirDs = alertingFactory.dataSource.build({ name: 'Mimir', uid: 'mimir' });
const prometheusDs = alertingFactory.dataSource.build({ name: 'Prometheus', uid: 'prometheus' });

beforeEach(() => {
  returnToPrevious.mockClear();
  setPrometheusRules(mimirDs, createGroups('mimir', [1]));
  setPrometheusRules(prometheusDs, createGroups('prometheus', [1]));
});

// The global IntersectionObserver mock in public/test/jest-setup.ts auto-fires
// isIntersecting on observe(), which would cause runaway pagination here. Install
// a controllable mock that only fires when enterNode() is called.
const io = installControllableIntersectionObserver();

describe('RuleList - FilterView', () => {
  it('should render multiple pages of results', async () => {
    setPrometheusRules(
      mimirDs,
      [99, 102].map((ruleCount, groupIndex) =>
        alertingFactory.prometheus.group.build({
          file: 'test-mimir-namespace',
          name: `test-group-${groupIndex + 1}`,
          rules: Array.from({ length: ruleCount }, (_, ruleIndex) =>
            alertingFactory.prometheus.rule.build({ name: `mimir-test-rule-${groupIndex + 1}-${ruleIndex + 1}` })
          ),
        })
      )
    );

    render(<FilterView filterState={getFilter({ dataSourceNames: ['Mimir'] })} />);

    await loadMoreResults();
    const onePageResults = await screen.findAllByRole('treeitem');
    // FilterView loads rules in batches so it can load more than 100 rules for one page
    expect(onePageResults.length).toBeGreaterThanOrEqual(100);

    await loadMoreResults();
    const twoPageResults = await screen.findAllByRole('treeitem');
    expect(twoPageResults.length).toBeGreaterThanOrEqual(200);
    expect(twoPageResults.length).toBeGreaterThan(onePageResults.length);
  });

  it('should filter results beyond the first API page by group and rule name and link to the group', async () => {
    // Keep the matching group beyond the first API page of 2,000 groups.
    setPrometheusRules(mimirDs, [
      ...createGroups('mimir', Array.from({ length: 2000 }, (_, index) => index + 1), [1]),
      ...createGroups('mimir', [4501]),
    ]);

    render(
      <FilterView
        filterState={getFilter({
          dataSourceNames: ['Mimir'],
          groupName: 'test-group-4501',
          ruleName: 'mimir-test-rule-1',
        })}
      />
    );

    await loadMoreResults();

    const matchingRule = await screen.findByRole('treeitem', {
      name: /mimir-test-rule-1/,
    });

    expect(matchingRule).toHaveTextContent('mimir-test-rule-1');
    expect(matchingRule).toHaveTextContent('test-mimir-namespace');
    expect(matchingRule).toHaveTextContent('test-group-4501');
    const groupLink = within(matchingRule).getByRole('link', { name: 'test-group-4501' });
    expect(groupLink).toBeInTheDocument();
    expect(groupLink).toHaveAttribute(
      'href',
      '/alerting/mimir/namespaces/test-mimir-namespace/groups/test-group-4501/view'
    );
    expect(await screen.findByText(/No more results/)).toBeInTheDocument();
  });

  it('should display rules from multiple datasources', async () => {
    setPrometheusRules(
      mimirDs,
      createGroups('mimir', [1, 123, 1123, 1230, 1231, 1232, 1233, 1234, 1235, 1236, 1237, 1238, 1239, 2123, 3123, 4123])
    );
    setPrometheusRules(prometheusDs, createGroups('prometheus', [1, 123]));

    render(<FilterView filterState={getFilter({ groupName: 'test-group-123', ruleName: 'test-rule-3' })} />);

    await loadMoreResults();

    // Fuzzy search for 'test-group-123' matches:
    // Mimir: 15 groups (123, 1123, 1230-1239, 2123, 3123, 4123)
    // Prometheus: 1 group (123)
    const matchingMimirRules = await screen.findAllByRole('treeitem', {
      name: /mimir-test-rule-3/,
    });
    const matchingPrometheusRule = await screen.findByRole('treeitem', {
      name: /prometheus-test-rule-3/,
    });

    // Mimir: 15 groups × 1 rule each = 15 rules
    // Prometheus: 1 group × 1 rule = 1 rule
    expect(matchingMimirRules).toHaveLength(15);
    expect(matchingPrometheusRule).toBeInTheDocument();

    expect(await screen.findByText(/No more results/)).toBeInTheDocument();
  });

  it('should display empty state when no rules are found', async () => {
    render(<FilterView filterState={getFilter({ groupName: 'non-existing-group' })} />);

    await loadMoreResults();

    expect(await screen.findByText(/No matching rules found/)).toBeInTheDocument();
  });
});

function createGroups(source: 'mimir' | 'prometheus', groupNumbers: number[], ruleNumbers = [1, 2, 3]) {
  const group = alertingFactory.prometheus.group.build({
    file: `test-${source}-namespace`,
    rules: ruleNumbers.map((number) => alertingFactory.prometheus.rule.build({ name: `${source}-test-rule-${number}` })),
  });

  return groupNumbers.map((number) => ({ ...group, name: `test-group-${number}` }));
}

async function loadMoreResults() {
  io.enterNode(screen.getByTestId('load-more-helper'));
  await waitForElementToBeRemoved(screen.queryAllByTestId('alert-rule-list-item-loader'));
}

function getFilter(overrides: Partial<RulesFilter> = {}): RulesFilter {
  return {
    dataSourceNames: [],
    freeFormWords: [],
    labels: [],
    ...overrides,
  };
}

describe('RuleList - FilterView with the Prometheus Alerting plugin', () => {
  setupPrometheusAlertingPlugin();

  it('leaves data source managed rules out and says where they went', async () => {
    render(<FilterView filterState={getFilter({ dataSourceNames: ['Mimir'] })} />);

    expect(await screen.findByRole('link', { name: /view rules in prometheus alerting/i })).toHaveAttribute(
      'href',
      `/a/${SupportedPlugin.PrometheusAlerting}/rules`
    );

    // The only data source in the filter is one the plugin owns, so nothing is left to list.
    await loadMoreResults();
    expect(screen.queryAllByRole('treeitem')).toHaveLength(0);
  });

  it('offers to run the same search in the plugin when nothing matched', async () => {
    const { user } = render(<FilterView filterState={getFilter({ groupName: 'non-existing-group' })} />);

    await loadMoreResults();

    expect(await screen.findByText(/No matching rules found/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /search data source managed rules/i });
    expect(link).toHaveAttribute('href', `/a/${SupportedPlugin.PrometheusAlerting}/rules`);
    link.addEventListener('click', (event) => event.preventDefault());
    await user.click(link);
    expect(returnToPrevious).toHaveBeenCalledWith('Alert rules');
  });
});
