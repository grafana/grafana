import { render, screen, waitFor, within } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { setPluginComponentsHook, setPluginLinksHook, setReturnToPreviousHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { setPrometheusRules } from '../mocks/server/configure';
import { alertingFactory } from '../mocks/server/db';

import { GroupedView } from './GroupedView';
import { DATA_SOURCE_GROUP_PAGE_SIZE } from './PaginatedDataSourceLoader';

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));
setReturnToPreviousHook(() => () => {});

grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);

setupMswServer();

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
  group: (group: string | RegExp) => byRole('treeitem', { name: group }),
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

    expect(firstPageGroups).toHaveLength(40);
    expect(firstPageGroups[0]).toHaveTextContent('test-group-1');
    expect(firstPageGroups[24]).toHaveTextContent('test-group-25');
    expect(firstPageGroups[39]).toHaveTextContent('test-group-40');

    const loadMoreButton = await within(mimirSection).findByRole('button', { name: /Show more/i });
    await user.click(loadMoreButton);

    await waitFor(() => expect(loadMoreButton).toBeEnabled());

    const secondPageGroups = await ui.group(/test-group-(4[1-9]|[5-7][0-9]|80)/).findAll(mimirNamespace);

    expect(secondPageGroups).toHaveLength(DATA_SOURCE_GROUP_PAGE_SIZE);
    expect(secondPageGroups[0]).toHaveTextContent('test-group-41');
    expect(secondPageGroups[24]).toHaveTextContent('test-group-65');
    expect(secondPageGroups[39]).toHaveTextContent('test-group-80');
  });

  it('should disable next button when there is no more data', async () => {
    const { user } = render(<GroupedView />);

    const prometheusSection = await ui.dsSection(/Prometheus/).find();
    const promNamespace = await ui.namespace(/test-prometheus-namespace/).find(prometheusSection);

    // initial load – should have all groups 1-40
    await ui.group(/test-group-([1-9]|[1-3][0-9]|40)/).findAll(promNamespace);

    // fetch page 2
    const loadMoreButton = await ui.loadMoreButton().find(prometheusSection);
    await waitFor(() => expect(loadMoreButton).toBeEnabled());

    // we should now have all groups 1-80
    await ui.group(/test-group-([1-9]|[1-7][0-9]|80)/).findAll(promNamespace);

    // fetch third page
    await waitFor(() => expect(loadMoreButton).toBeEnabled());
    await user.click(loadMoreButton);

    // we should now have all groups 1-130
    await ui.group(/test-group-([1-9]|[1-9][0-9]|1[0-2][0-9]|130)/).findAll(promNamespace);

    expect(loadMoreButton).not.toBeInTheDocument();
  });
});
