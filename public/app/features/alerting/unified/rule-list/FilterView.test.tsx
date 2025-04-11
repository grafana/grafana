import { mockIntersectionObserver } from 'jsdom-testing-mocks';
import { act, render, screen, waitForElementToBeRemoved } from 'test/test-utils';

import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { setPrometheusRules } from '../mocks/server/configure';
import { alertingFactory } from '../mocks/server/db';
import { RulesFilter } from '../search/rulesSearchParser';

import { FilterView } from './FilterView';

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);

setupMswServer();

const mimirGroups = alertingFactory.prometheus.group.buildList(5000, {
  file: 'test-mimir-namespace',
  rules: alertingFactory.prometheus.rule.buildList(3, undefined, { transient: { namePrefix: 'mimir' } }),
});
alertingFactory.prometheus.group.rewindSequence();
const prometheusGroups = alertingFactory.prometheus.group.buildList(200, {
  file: 'test-prometheus-namespace',
  rules: alertingFactory.prometheus.rule.buildList(3, undefined, { transient: { namePrefix: 'prometheus' } }),
});

const mimirDs = alertingFactory.dataSource.build({ name: 'Mimir', uid: 'mimir' });
const prometheusDs = alertingFactory.dataSource.build({ name: 'Prometheus', uid: 'prometheus' });

beforeEach(() => {
  setPrometheusRules(mimirDs, mimirGroups);
  setPrometheusRules(prometheusDs, prometheusGroups);
});

const io = mockIntersectionObserver();

describe('RuleList - FilterView', () => {
  it('should render multiple pages of results', async () => {
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

  it('should filter results by group and rule name ', async () => {
    render(
      <FilterView
        filterState={getFilter({ dataSourceNames: ['Mimir'], groupName: 'test-group-4501', ruleName: 'test-rule-2' })}
      />
    );

    await loadMoreResults();

    const matchingRule = await screen.findByRole('treeitem', {
      name: /mimir-test-rule-2/,
    });

    expect(matchingRule).toHaveTextContent('mimir-test-rule-2');
    expect(matchingRule).toHaveTextContent('test-mimir-namespace');
    expect(matchingRule).toHaveTextContent('test-group-4501');
    expect(await screen.findByText(/No more results/)).toBeInTheDocument();
  });

  it('should display rules from multiple datasources', async () => {
    render(<FilterView filterState={getFilter({ groupName: 'test-group-181', ruleName: 'test-rule-2' })} />);

    await loadMoreResults();

    // Mimir has 11 matching rules, 181, 1810, 1811 ... 1819
    const matchingMimirRules = await screen.findAllByRole('treeitem', {
      name: /mimir-test-rule-2/,
    });
    const matchingPrometheusRule = await screen.findByRole('treeitem', {
      name: /prometheus-test-rule-2/,
    });

    expect(matchingMimirRules).toHaveLength(11);
    expect(matchingPrometheusRule).toBeInTheDocument();

    expect(await screen.findByText(/No more results/)).toBeInTheDocument();
  });

  it('should display empty state when no rules are found', async () => {
    render(<FilterView filterState={getFilter({ groupName: 'non-existing-group' })} />);

    await loadMoreResults();

    expect(await screen.findByText(/No matching rules found/)).toBeInTheDocument();
  });
});

async function loadMoreResults() {
  act(() => {
    io.enterNode(screen.getByTestId('load-more-helper'));
  });
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
