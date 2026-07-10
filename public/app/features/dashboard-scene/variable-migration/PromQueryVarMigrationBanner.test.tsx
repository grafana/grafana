import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { store } from '@grafana/data';
import { config } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { QueryVariable, SceneQueryRunner, SceneVariableSet, VizPanel, type SceneVariable } from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { PromQueryVarMigrationBanner, getBannerDismissKey } from './PromQueryVarMigrationBanner';
import { PromQueryVarMigrationDrawer } from './PromQueryVarMigrationDrawer';

const instanceSettingsMap: Record<string, { uid: string; type: string; name: string }> = {
  'prom-a': { uid: 'prom-a', type: 'prometheus', name: 'Prometheus A' },
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: (ref: DataSourceRef | string | null | undefined) => {
      const uid = typeof ref === 'string' ? ref : ref?.uid;
      return uid === undefined ? instanceSettingsMap['prom-a'] : instanceSettingsMap[uid];
    },
  }),
}));

const DASHBOARD_UID = 'banner-test';

function renderBanner(dashboard: DashboardScene) {
  return render(
    <OpenFeatureProvider client={getTestFeatureFlagClient()}>
      <PromQueryVarMigrationBanner dashboard={dashboard} />
    </OpenFeatureProvider>
  );
}

function buildDashboard({ canEdit = true, exprs = ['up{instance=~"$instance"}'] } = {}): DashboardScene {
  const variables: SceneVariable[] = [
    new QueryVariable({
      name: 'instance',
      datasource: { uid: 'prom-a', type: 'prometheus' },
      query: 'label_values(up, instance)',
      value: 'server-1',
    }),
  ];

  return new DashboardScene({
    title: 'Banner test dashboard',
    uid: DASHBOARD_UID,
    meta: { canEdit },
    $variables: new SceneVariableSet({ variables }),
    body: DefaultGridLayoutManager.fromVizPanels(
      exprs.map(
        (expr, index) =>
          new VizPanel({
            key: `panel-${index + 1}`,
            title: `Panel ${index + 1}`,
            pluginId: 'timeseries',
            $data: new SceneQueryRunner({
              datasource: { uid: 'prom-a' },
              queries: [{ refId: 'A', expr }],
            }),
          })
      )
    ),
  });
}

describe('PromQueryVarMigrationBanner', () => {
  beforeEach(() => {
    setTestFlags({ [FlagKeys.GrafanaPrometheusQueryVariableMigration]: true });
    config.featureToggles.dashboardUnifiedDrilldownControls = true;
    store.delete(getBannerDismissKey(DASHBOARD_UID));
  });

  afterAll(() => {
    setTestFlags({});
  });

  it('renders when the flags are on and safe candidates exist', () => {
    renderBanner(buildDashboard());

    expect(screen.getByRole('button', { name: /review migration/i })).toBeInTheDocument();
  });

  it('renders nothing when the OpenFeature flag is off', () => {
    setTestFlags({ [FlagKeys.GrafanaPrometheusQueryVariableMigration]: false });

    const { container } = renderBanner(buildDashboard());

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when dashboardUnifiedDrilldownControls is off', () => {
    config.featureToggles.dashboardUnifiedDrilldownControls = false;

    const { container } = renderBanner(buildDashboard());

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the user cannot edit the dashboard', () => {
    const { container } = renderBanner(buildDashboard({ canEdit: false }));

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there are no safe candidates', () => {
    // The variable is interpolated in metric position: detected but disqualified
    const { container } = renderBanner(buildDashboard({ exprs: ['rate($instance[5m])'] }));

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when previously dismissed for this dashboard', () => {
    store.set(getBannerDismissKey(DASHBOARD_UID), true);

    const { container } = renderBanner(buildDashboard());

    expect(container).toBeEmptyDOMElement();
  });

  it('persists the dismissal per dashboard uid', async () => {
    renderBanner(buildDashboard());

    await userEvent.click(screen.getByRole('button', { name: /close alert/i }));

    expect(store.getBool(getBannerDismissKey(DASHBOARD_UID), false)).toBe(true);
    expect(screen.queryByRole('button', { name: /review migration/i })).not.toBeInTheDocument();
  });

  it('opens the migration drawer on review', async () => {
    const dashboard = buildDashboard();
    renderBanner(dashboard);

    await userEvent.click(screen.getByRole('button', { name: /review migration/i }));

    expect(dashboard.state.overlay).toBeInstanceOf(PromQueryVarMigrationDrawer);
  });
});
