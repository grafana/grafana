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

const mimirGroups = alertingFactory.group.buildList(5000, { file: 'test-mimir-namespace' });
alertingFactory.group.rewindSequence();
const prometheusGroups = alertingFactory.group.buildList(200, { file: 'test-prometheus-namespace' });

const mimirDs = alertingFactory.dataSource.build({ name: 'Mimir', uid: 'mimir' });
const prometheusDs = alertingFactory.dataSource.build({ name: 'Prometheus', uid: 'prometheus' });

beforeEach(() => {
  setPrometheusRules(mimirDs, mimirGroups);
  setPrometheusRules(prometheusDs, prometheusGroups);
});

const io = mockIntersectionObserver();

describe('RuleList - FilterView', () => {
  jest.retryTimes(2);
  it('should render multiple pages of results', async () => {
    render(<FilterView filterState={getFilter({ dataSourceNames: ['Mimir'] })} />);

    await loadMoreResults();
    expect(await screen.findAllByRole('treeitem')).toHaveLength(100);

    await loadMoreResults();
    expect(await screen.findAllByRole('treeitem')).toHaveLength(200);
  });

  it('should filter results by group and rule name ', async () => {
    render(
      <FilterView
        filterState={getFilter({ dataSourceNames: ['Mimir'], groupName: 'test-group-4501', ruleName: 'test-rule-8' })}
      />
    );

    await loadMoreResults();

    const matchingRule = (await screen.findAllByRole('treeitem')).at(0);
    expect(matchingRule).toBeInTheDocument();

    expect(matchingRule).toHaveTextContent('test-rule-8');
    expect(matchingRule).toHaveTextContent('test-mimir-namespace');
    expect(matchingRule).toHaveTextContent('test-group-4501');
    expect(await screen.findByText(/No more results/)).toBeInTheDocument();
  });

  it('should display rules from multiple datasources', async () => {
    render(<FilterView filterState={getFilter({ groupName: 'test-group-181', ruleName: 'test-rule-5' })} />);

    await loadMoreResults();

    // Mimir has 11 matching rules, 181, 1810, 1811 ... 1819
    const matchingMimirRules = await screen.findAllByRole('treeitem', {
      name: /test-rule-5 Mimir test-mimir-namespace test-group-181/,
    });
    const matchingPrometheusRule = await screen.findByRole('treeitem', {
      name: /test-rule-5 Prometheus test-prometheus-namespace test-group-181/,
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
  await waitForElementToBeRemoved(screen.queryAllByTestId('alert-rule-list-item-loader'), { timeout: 8000 });
}

function getFilter(overrides: Partial<RulesFilter> = {}): RulesFilter {
  return {
    dataSourceNames: [],
    freeFormWords: [],
    labels: [],
    ...overrides,
  };
}
