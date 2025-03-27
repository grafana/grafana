import { render, screen, waitFor, within } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { setPluginComponentsHook, setPluginLinksHook, setReturnToPreviousHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { setPrometheusRules } from '../mocks/server/configure';
import { alertingFactory } from '../mocks/server/db';

import { GroupedView } from './GroupedView';

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
  nextButton: () => byRole('button', { name: /next page/ }),
};

describe('RuleList - GroupedView', () => {
  it('should render datasource sections', async () => {
    render(<GroupedView />);

    const mimirSection = await screen.findByRole('listitem', { name: /Mimir/ });
    const prometheusSection = await screen.findByRole('listitem', { name: /Prometheus/ });

    expect(mimirSection).toBeInTheDocument();
    expect(prometheusSection).toBeInTheDocument();
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

    const nextButton = await within(mimirSection).findByRole('button', { name: /next page/ });
    await user.click(nextButton);

    await waitFor(() => expect(nextButton).toBeEnabled());

    const secondPageGroups = await ui.group(/test-group-(4[1-9]|[5-7][0-9]|80)/).findAll(mimirNamespace);

    expect(secondPageGroups).toHaveLength(40);
    expect(secondPageGroups[0]).toHaveTextContent('test-group-41');
    expect(secondPageGroups[24]).toHaveTextContent('test-group-65');
    expect(secondPageGroups[39]).toHaveTextContent('test-group-80');
  });

  it('should disable next button when there is no more data', async () => {
    const { user } = render(<GroupedView />);

    const prometheusSection = await ui.dsSection(/Prometheus/).find();

    const nextButton = await ui.nextButton().find(prometheusSection);
    await waitFor(() => expect(nextButton).toBeEnabled());

    // Fetch second page
    await user.click(nextButton);

    // Fetch third page
    await waitFor(() => expect(nextButton).toBeEnabled());
    await user.click(nextButton);

    // Fetch fourth page
    await waitFor(() => expect(nextButton).toBeEnabled(), { timeout: 10000 });
    await user.click(nextButton);

    const promNamespace = await ui.namespace(/test-prometheus-namespace/).find(prometheusSection);
    const lastPageGroups = await ui.group(/test-group-(12[1-9]|130)/).findAll(promNamespace);

    expect(lastPageGroups).toHaveLength(10);
    expect(lastPageGroups.at(0)).toHaveTextContent('test-group-121');
    expect(lastPageGroups.at(6)).toHaveTextContent('test-group-127');
    expect(lastPageGroups.at(9)).toHaveTextContent('test-group-130');
    expect(nextButton).toBeDisabled();
  });
});
