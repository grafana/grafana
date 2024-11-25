import { act, screen, waitForElementToBeRemoved } from '@testing-library/react';
import { mockIntersectionObserver } from 'jsdom-testing-mocks';
import { DefaultBodyType, http, HttpResponse, HttpResponseResolver, PathParams } from 'msw';
import { render } from 'test/test-utils';

import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types';
import { PromRuleGroupDTO, PromRulesResponse } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { alertingFactory } from '../mocks/server/db';

import { GroupedView } from './GroupedView';
import RuleList from './RuleList.v2';

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);

const server = setupMswServer();

const mimirGroups = alertingFactory.group.buildList(5000, { file: 'test-mimir-namespace' });
alertingFactory.group.rewindSequence();
const prometheusGroups = alertingFactory.group.buildList(200, { file: 'test-prometheus-namespace' });

const mimirDs = alertingFactory.dataSource.build({ name: 'Mimir', uid: 'mimir' });
const prometheusDs = alertingFactory.dataSource.build({ name: 'Prometheus', uid: 'prometheus' });

beforeEach(() => {
  server.use(http.get(`/api/prometheus/${mimirDs.uid}/api/v1/rules`, paginatedHandlerFor(mimirGroups)));
  server.use(http.get(`/api/prometheus/${prometheusDs.uid}/api/v1/rules`, paginatedHandlerFor(prometheusGroups)));
});

const io = mockIntersectionObserver();

async function loadMoreResults() {
  act(() => {
    io.enterNode(screen.getByTestId('load-more-helper'));
  });
  await waitForElementToBeRemoved(screen.queryAllByTestId('alert-rule-list-item-loader'), { timeout: 3000 });
}

describe('RuleList - GroupedView', () => {
  it('should render datasource sections', async () => {
    render(<GroupedView />);

    const mimirSection = await screen.findByRole('listitem', { name: /Mimir/ });
    const prometheusSection = await screen.findByRole('listitem', { name: /Prometheus/ });

    expect(mimirSection).toBeInTheDocument();
    expect(prometheusSection).toBeInTheDocument();
  });
});

describe('RuleList - FilterView', () => {
  it('should render multiple pages of results', async () => {
    render(<RuleList />, {
      historyOptions: { initialEntries: ['/alerting/list?search=datasource:"Mimir"'] },
    });

    await loadMoreResults();
    expect(await screen.findAllByRole('treeitem')).toHaveLength(100);

    await loadMoreResults();
    expect(await screen.findAllByRole('treeitem')).toHaveLength(200);
  });

  it('should filter results by group and rule name ', async () => {
    render(<RuleList />, {
      historyOptions: {
        initialEntries: ['/alerting/list?search=datasource:"Mimir" group:"test-group-4501" rule:"test-rule-8"'],
      },
    });

    await loadMoreResults();

    const matchingRule = await screen.findByRole('treeitem', {
      name: /test-rule-8 test-mimir-namespace test-group-4501/,
    });
    expect(matchingRule).toBeInTheDocument();

    expect(matchingRule).toHaveTextContent('test-rule-8');
    expect(matchingRule).toHaveTextContent('test-group-4501');
    expect(await screen.findByText(/No more results/)).toBeInTheDocument();
  });

  it('should display rules from multiple datasources', async () => {
    render(<RuleList />, {
      historyOptions: {
        initialEntries: ['/alerting/list?search=group:"test-group-181" rule:"test-rule-5"'],
      },
    });

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
    render(<RuleList />, {
      historyOptions: { initialEntries: ['/alerting/list?search=group:"non-existing-group"'] },
    });

    await loadMoreResults();

    expect(await screen.findByText(/No matching rules found/)).toBeInTheDocument();
  });
});

function paginatedHandlerFor(
  groups: PromRuleGroupDTO[]
): HttpResponseResolver<PathParams, DefaultBodyType, PromRulesResponse> {
  return ({ request }) => {
    const { searchParams } = new URL(request.url);
    const groupLimitParam = searchParams.get('group_limit');
    const groupNextToken = searchParams.get('group_next_token');

    const groupLimit = groupLimitParam ? parseInt(groupLimitParam, 10) : undefined;

    const orderedGroupsWithCursor = groups.map((group) => ({
      ...group,
      id: Buffer.from(`${group.file}-${group.name}`).toString('base64url'),
    }));

    const startIndex = groupNextToken
      ? orderedGroupsWithCursor.findIndex((group) => group.id === groupNextToken) + 1
      : 0;
    const endIndex = groupLimit ? startIndex + groupLimit + 1 : orderedGroupsWithCursor.length;

    const groupsResult = orderedGroupsWithCursor.slice(startIndex, endIndex);
    const nextToken =
      groupLimit && orderedGroupsWithCursor.length > groupLimit ? orderedGroupsWithCursor.at(endIndex)?.id : undefined;

    return HttpResponse.json<PromRulesResponse>({
      status: 'success',
      data: { groups: groupsResult, groupNextToken: nextToken },
    });
  };
}
