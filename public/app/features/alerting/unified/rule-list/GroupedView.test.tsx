import { render, screen, waitFor, within } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { setPluginComponentsHook, setPluginLinksHook, setReturnToPreviousHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { setPrometheusRules } from '../mocks/server/configure';
import { alertingFactory } from '../mocks/server/db';

import { GroupedView } from './GroupedView';
import { FRONTED_GROUPED_PAGE_SIZE } from './paginationLimits';

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));
setReturnToPreviousHook(() => () => {});

grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);

setupMswServer();

// increase timeout for this test file, it's a rather slow one since we're testing with a _lot_ of DOM data
jest.setTimeout(60 * 1000);

const mimirGroups = alertingFactory.prometheus.group.buildList(500, { file: 'test-mimir-namespace' });
alertingFactory.prometheus.group.rewindSequence();
const prometheusGroups = alertingFactory.prometheus.group.buildList(130, { file: 'test-prometheus-namespace' });

const mimirDs = alertingFactory.dataSource.build({ name: 'Mimir', uid: 'mimir' });
const prometheusDs = alertingFactory.dataSource.build({ name: 'Prometheus', uid: 'prometheus' });

beforeEach(() => {
  setPrometheusRules(mimirDs, mimirGroups);
  setPrometheusRules(prometheusDs, prometheusGroups);
});

const ui = {
  dsSection: (ds: string | RegExp) => byRole('listitem', { name: ds }),
  namespace: (ns: string | RegExp) => byRole('treeitem', { name: ns }),
  group: (group: string | RegExp) => byRole('link', { name: group }),
  loadMoreButton: () => byRole('button', { name: /Show more/i }),
};

describe('RuleList - GroupedView', () => {
  it('should render datasource sections', async () => {
    render(<GroupedView />);

    const mimirSection = await screen.findByRole('listitem', { name: /Mimir/ });
    const prometheusSection = await screen.findByRole('listitem', { name: /Prometheus/ });

    expect(mimirSection).toBeInTheDocument();
    expect(prometheusSection).toBeInTheDocument();

    // assert if namespace and groups have all of the metadata
    expect(within(mimirSection).getByRole('heading', { name: 'test-mimir-namespace' })).toBeInTheDocument();
    expect(within(mimirSection).getByRole('treeitem', { name: 'test-group-1 10s' })).toBeInTheDocument();
  });

  it('should paginate through groups', async () => {
    const { user } = render(<GroupedView />);

    const mimirSection = await ui.dsSection(/Mimir/).find();

    expect(mimirSection).toBeInTheDocument();

    const mimirNamespace = await ui.namespace(/test-mimir-namespace/).find(mimirSection);
    const firstPageGroups = await ui.group(/test-group-([1-9]|[1-3][0-9]|40)/).findAll(mimirNamespace);

    expect(firstPageGroups).toHaveLength(FRONTED_GROUPED_PAGE_SIZE);
    expect(firstPageGroups[0]).toHaveTextContent('test-group-1');
    expect(firstPageGroups[24]).toHaveTextContent('test-group-25');
    expect(firstPageGroups[39]).toHaveTextContent('test-group-40');

    const loadMoreButton = await within(mimirSection).findByRole('button', { name: /Show more/i });
    await user.click(loadMoreButton);

    await waitFor(() => expect(loadMoreButton).toBeEnabled());

    const secondPageGroups = await ui.group(/test-group-(4[1-9]|[5-7][0-9]|80)/).findAll(mimirNamespace);

    expect(secondPageGroups).toHaveLength(FRONTED_GROUPED_PAGE_SIZE);
    expect(secondPageGroups[0]).toHaveTextContent('test-group-41');
    expect(secondPageGroups[24]).toHaveTextContent('test-group-65');
    expect(secondPageGroups[39]).toHaveTextContent('test-group-80');
  });

  it('should disable next button when there is no more data', async () => {
    const { user } = render(<GroupedView />);

    const prometheusSection = await ui.dsSection(/Prometheus/).find();
    const promNamespace = await ui.namespace(/test-prometheus-namespace/).find(prometheusSection);
    const loadMoreButton = ui.loadMoreButton();

    // initial load – should have all groups 1-40
    await ui.group('test-group-40').find(promNamespace);

    // fetch page 2
    await user.click(await loadMoreButton.find(prometheusSection));
    // we should now have all groups 1-80
    await ui.group('test-group-80').find(promNamespace);

    // fetch page 3
    await user.click(await loadMoreButton.find(prometheusSection));
    // we should now have all groups 1-120
    await ui.group('test-group-120').find(promNamespace);

    // fetch page 4
    await user.click(await loadMoreButton.find(prometheusSection));
    // we should now have all groups 1-130
    await ui.group('test-group-130').find(promNamespace);

    expect(loadMoreButton.query(prometheusSection)).not.toBeInTheDocument();
  });
});
