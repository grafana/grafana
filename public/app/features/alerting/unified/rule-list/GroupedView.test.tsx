import { HttpResponse, delay, http } from 'msw';
import { render, screen, waitFor, within } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { config, setPluginComponentsHook, setPluginLinksHook, setReturnToPreviousHook } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import server from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { addPlugin, setPrometheusRules } from '../mocks/server/configure';
import { alertingFactory } from '../mocks/server/db';
import { pluginMeta } from '../testSetup/plugins';
import { setupPrometheusAlertingPlugin } from '../testSetup/prometheusAlertingPlugin';
import { SupportedPlugin } from '../types/pluginBridges';

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

    const grafanaSection = await screen.findByRole('listitem', { name: /Grafana-managed/ });
    const mimirSection = await screen.findByRole('listitem', { name: /Mimir/ });
    const prometheusSection = await screen.findByRole('listitem', { name: /Prometheus/ });

    expect(within(grafanaSection).getByRole('button', { name: /Collapse/ })).toBeInTheDocument();
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

  it('should hide data sources with no rules by default, and show how many are hidden', async () => {
    setPrometheusRules(prometheusDs, []);
    render(<GroupedView />);

    await ui.dsSection(/Mimir/).find();

    expect(ui.dsSection(/Prometheus/).query()).not.toBeInTheDocument();
    expect(await screen.findByText('1 data source with no rules is hidden')).toBeInTheDocument();
  });

  it('should stop counting a data source as "hidden" once the route proxy drops it from the list', async () => {
    setPrometheusRules(prometheusDs, []);
    const originalUnifiedAlertingEnabled = config.unifiedAlertingEnabled;

    try {
      const { rerender } = render(<GroupedView />);

      await ui.dsSection(/Mimir/).find();
      expect(await screen.findByText('1 data source with no rules is hidden')).toBeInTheDocument();

      config.unifiedAlertingEnabled = true;
      setTestFlags({ [FlagKeys.AlertingDataSourceManagedRouteProxy]: true });
      addPlugin(pluginMeta[SupportedPlugin.PrometheusAlerting]);
      rerender(<GroupedView />);

      await waitFor(() => {
        expect(screen.queryByText(/data sources? with no rules (is|are) hidden/)).not.toBeInTheDocument();
      });
    } finally {
      config.unifiedAlertingEnabled = originalUnifiedAlertingEnabled;
      setTestFlags();
    }
  });

  it('should reveal hidden data sources when "Show all" is clicked', async () => {
    setPrometheusRules(prometheusDs, []);
    const onHideEmptyDataSourcesChange = jest.fn();
    const { user, rerender } = render(
      <GroupedView hideEmptyDataSources={true} onHideEmptyDataSourcesChange={onHideEmptyDataSourcesChange} />
    );

    await ui.dsSection(/Mimir/).find();
    await user.click(await screen.findByRole('button', { name: 'Show all' }));

    expect(onHideEmptyDataSourcesChange).toHaveBeenCalledWith(false);

    rerender(<GroupedView hideEmptyDataSources={false} onHideEmptyDataSourcesChange={onHideEmptyDataSourcesChange} />);

    expect(await ui.dsSection(/Prometheus/).find()).toBeInTheDocument();
  });

  it('should show data sources with no rules when hideEmptyDataSources is false', async () => {
    setPrometheusRules(prometheusDs, []);
    render(<GroupedView hideEmptyDataSources={false} />);

    const prometheusSection = await ui.dsSection(/Prometheus/).find();

    expect(within(prometheusSection).getByText('No rules found')).toBeInTheDocument();
    expect(screen.queryByText(/data sources? with no rules (is|are) hidden/)).not.toBeInTheDocument();
  });

  it('should stop counting a data source as "pending" once its discovery request errors', async () => {
    server.use(
      http.get(`/api/datasources/proxy/uid/${prometheusDs.uid}/api/v1/status/buildinfo`, () =>
        HttpResponse.json({ message: 'internal error' }, { status: 500 })
      )
    );

    render(<GroupedView />);

    await ui.dsSection(/Mimir/).find();
    await screen.findByRole('button', { name: /Error/i });

    expect(screen.queryByText(/Checking \d+ more data sources?/)).not.toBeInTheDocument();
  });

  it('should not show a data source header until its first fetch settles, and should say so while waiting', async () => {
    server.use(
      http.get(`/api/prometheus/${prometheusDs.uid}/api/v1/rules`, async () => {
        await delay('infinite');
        return HttpResponse.json({ status: 'success', data: { groups: [] } });
      })
    );

    render(<GroupedView />);

    await ui.dsSection(/Mimir/).find();

    expect(ui.dsSection(/Prometheus/).query()).not.toBeInTheDocument();
    expect(await screen.findByText('Checking 1 more data source')).toBeInTheDocument();
  });

  it('should replace the "checking" notice with the hidden-count notice once a slow empty data source settles', async () => {
    server.use(
      http.get(`/api/prometheus/${prometheusDs.uid}/api/v1/rules`, async () => {
        await delay(300);
        return HttpResponse.json({ status: 'success', data: { groups: [] } });
      })
    );

    render(<GroupedView />);

    expect(await screen.findByText('Checking 1 more data source')).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByText('Checking 1 more data source')).not.toBeInTheDocument());
    expect(await screen.findByText('1 data source with no rules is hidden')).toBeInTheDocument();
    expect(ui.dsSection(/Prometheus/).query()).not.toBeInTheDocument();
  });
});

describe('RuleList - GroupedView with the Prometheus Alerting plugin', () => {
  setupPrometheusAlertingPlugin();

  it('drops the data source sections and says where those rules went', async () => {
    render(<GroupedView />);

    const grafanaSection = await screen.findByRole('listitem', { name: /Grafana-managed/ });
    expect(
      await within(grafanaSection).findByText(/data sources? (is|are) managed by the Prometheus Alerting plugin/)
    ).toBeInTheDocument();
    expect(within(grafanaSection).getByRole('link', { name: 'View' })).toHaveAttribute(
      'href',
      `/a/${SupportedPlugin.PrometheusAlerting}/rules`
    );
    expect(within(grafanaSection).queryByRole('button', { name: /Collapse/ })).not.toBeInTheDocument();

    expect(screen.queryByRole('listitem', { name: /Mimir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: /Prometheus/ })).not.toBeInTheDocument();
  });
});
