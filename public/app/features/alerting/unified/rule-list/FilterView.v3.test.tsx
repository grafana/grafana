import { HttpResponse, http } from 'msw';
import { act, render, screen, waitFor, waitForElementToBeRemoved } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { alertRuleHitFactory, recordingRuleHitFactory } from '../mocks/server/entities/k8s/ruleSearchHits';
import {
  RULES_ALERTING_API_SERVER_BASE_URL,
  rulesSearchHandlerFor,
} from '../mocks/server/handlers/k8s/rulesSearch.k8s';
import { type RulesFilter } from '../search/rulesSearchParser';

import { FilterViewV3 } from './FilterView.v3';

jest.mock('@grafana/assistant', () => ({
  useAssistant: () => ({ isAvailable: false, openAssistant: jest.fn() }),
}));

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

grantUserPermissions([AccessControlAction.AlertingRuleRead]);

const server = setupMswServer();

// The global IntersectionObserver mock in public/test/jest-setup.ts auto-fires isIntersecting on
// observe(), which would cause runaway pagination here. Install a controllable mock that only fires
// when enterNode()/leaveNode() is called.
const io = installControllableIntersectionObserver();

describe('RuleList - FilterView.v3', () => {
  it('renders alert and recording rule rows from search hits', async () => {
    server.use(
      rulesSearchHandlerFor([
        alertRuleHitFactory.build({
          name: 'alert-uid',
          title: 'My alert rule',
          folder: 'NAMESPACE_UID',
          group: 'my-group',
          interval: '5m',
        }),
        recordingRuleHitFactory.build({ name: 'recording-uid', title: 'My recording rule', folder: 'NAMESPACE_UID' }),
      ])
    );

    render(<FilterViewV3 filterState={getFilter()} />);

    expect(await screen.findByText('My alert rule')).toBeInTheDocument();
    expect(screen.getByText('My recording rule')).toBeInTheDocument();
    expect(screen.getAllByRole('treeitem')).toHaveLength(2);

    // folder title is resolved from the folder uid, not shown as the raw uid
    expect(await screen.findByText('Some Folder')).toBeInTheDocument();
    expect(screen.queryByText('NAMESPACE_UID')).not.toBeInTheDocument();
  });

  it('links each row to the rule view page by uid', async () => {
    server.use(rulesSearchHandlerFor([alertRuleHitFactory.build({ name: 'the-uid', title: 'Linked rule' })]));

    render(<FilterViewV3 filterState={getFilter()} />);

    const link = await screen.findByRole('link', { name: 'Linked rule' });
    expect(link).toHaveAttribute('href', expect.stringContaining('/alerting/grafana/the-uid/view'));
  });

  it('paginates via the load-more sentinel', async () => {
    // page size is 24, so 30 hits require a second page
    server.use(rulesSearchHandlerFor(alertRuleHitFactory.buildList(30)));

    render(<FilterViewV3 filterState={getFilter()} />);

    await waitFor(() => expect(screen.getAllByRole('treeitem')).toHaveLength(24));

    await loadMoreResults();

    expect(screen.getAllByRole('treeitem')).toHaveLength(30);
    // no more pages -> sentinel gone
    expect(screen.queryByTestId('load-more-helper')).not.toBeInTheDocument();
  });

  it('shows an empty state when no rules match', async () => {
    server.use(rulesSearchHandlerFor([]));

    render(<FilterViewV3 filterState={getFilter()} />);

    expect(await screen.findByText('No matching rules found')).toBeInTheDocument();
    expect(screen.queryAllByRole('treeitem')).toHaveLength(0);
  });

  it('shows an error state when the search request fails', async () => {
    server.use(
      http.get(`${RULES_ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/search`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 })
      )
    );

    render(<FilterViewV3 filterState={getFilter()} />);

    expect(await byRole('alert').find()).toHaveTextContent('Failed to load rules');
    expect(screen.queryAllByRole('treeitem')).toHaveLength(0);
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

function installControllableIntersectionObserver() {
  type Registration = {
    callback: IntersectionObserverCallback;
    observer: IntersectionObserver;
    elements: Set<Element>;
  };
  const registrations: Registration[] = [];

  global.IntersectionObserver = jest.fn().mockImplementation((callback: IntersectionObserverCallback) => {
    const registration: Registration = {
      callback,
      observer: null as unknown as IntersectionObserver,
      elements: new Set(),
    };
    const observer: IntersectionObserver = {
      root: null,
      rootMargin: '',
      scrollMargin: '',
      thresholds: [],
      observe: (element: Element) => {
        registration.elements.add(element);
      },
      unobserve: (element: Element) => {
        registration.elements.delete(element);
      },
      disconnect: () => {
        registration.elements.clear();
        const idx = registrations.indexOf(registration);
        if (idx >= 0) {
          registrations.splice(idx, 1);
        }
      },
      takeRecords: () => [],
    };
    registration.observer = observer;
    registrations.push(registration);
    return observer;
  }) as unknown as typeof IntersectionObserver;

  const fire = (element: Element, isIntersecting: boolean) => {
    for (const reg of registrations) {
      if (!reg.elements.has(element)) {
        continue;
      }
      const rect = element.getBoundingClientRect();
      const entry: IntersectionObserverEntry = {
        target: element,
        isIntersecting,
        intersectionRatio: isIntersecting ? 1 : 0,
        boundingClientRect: rect,
        intersectionRect: rect,
        rootBounds: null,
        time: performance.now(),
      };
      reg.callback([entry], reg.observer);
    }
  };

  return {
    enterNode: (element: Element) => fire(element, true),
    leaveNode: (element: Element) => fire(element, false),
  };
}
