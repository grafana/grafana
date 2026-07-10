import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  AdHocFiltersVariable,
  QueryVariable,
  SceneQueryRunner,
  SceneVariableSet,
  VizPanel,
  type SceneVariable,
} from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { PromQueryVarMigrationDrawer } from './PromQueryVarMigrationDrawer';
import { detectMigratableVariables } from './detect';

const publishMock = jest.fn();

const instanceSettingsMap: Record<string, { uid: string; type: string; name: string; meta: object }> = {
  'prom-a': { uid: 'prom-a', type: 'prometheus', name: 'Prometheus A', meta: {} },
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: () => ({ publish: publishMock }),
  getDataSourceSrv: () => ({
    getInstanceSettings: (ref: DataSourceRef | string | null | undefined) => {
      const uid = typeof ref === 'string' ? ref : ref?.uid;
      return uid === undefined ? instanceSettingsMap['prom-a'] : instanceSettingsMap[uid];
    },
  }),
}));

function buildDashboard(variables: SceneVariable[], exprs: string[], panelTitles: string[] = []): DashboardScene {
  return new DashboardScene({
    title: 'Drawer test dashboard',
    uid: 'drawer-test',
    isEditing: true,
    $variables: new SceneVariableSet({ variables }),
    body: DefaultGridLayoutManager.fromVizPanels(
      exprs.map(
        (expr, index) =>
          new VizPanel({
            key: `panel-${index + 1}`,
            title: panelTitles[index] ?? `Panel ${index + 1}`,
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

function promLabelVariable(name: string, overrides: Partial<ConstructorParameters<typeof QueryVariable>[0]> = {}) {
  return new QueryVariable({
    name,
    datasource: { uid: 'prom-a', type: 'prometheus' },
    query: `label_values(up, ${name})`,
    value: `${name}-value`,
    ...overrides,
  });
}

function setup({ withDisqualified = false } = {}) {
  const variables: SceneVariable[] = [promLabelVariable('instance'), promLabelVariable('job')];
  const exprs = ['up{instance=~"$instance", job="$job"}'];
  const panelTitles: string[] = [];

  if (withDisqualified) {
    variables.push(promLabelVariable('pod'));
    exprs.push('up{pod=~"$pod"}');
    // $pod in a panel title disqualifies it
    panelTitles.push('Panel 1', 'Pods on $pod');
  }

  const dashboard = buildDashboard(variables, exprs, panelTitles);
  const candidates = detectMigratableVariables(dashboard);
  const onApplied = jest.fn();
  const drawer = new PromQueryVarMigrationDrawer({ candidates, onApplied });
  dashboard.showModal(drawer);

  render(<drawer.Component model={drawer} />);

  return { dashboard, drawer, onApplied };
}

describe('PromQueryVarMigrationDrawer', () => {
  beforeEach(() => {
    publishMock.mockClear();
  });

  it('renders safe candidates checked and enabled, grouped under the datasource', () => {
    setup();

    expect(screen.getByText('Prometheus A')).toBeInTheDocument();
    expect(screen.getByTestId('migration-candidate-instance')).toBeChecked();
    expect(screen.getByTestId('migration-candidate-instance')).toBeEnabled();
    expect(screen.getByTestId('migration-candidate-job')).toBeChecked();
  });

  it('renders disqualified candidates unchecked and disabled', () => {
    setup({ withDisqualified: true });

    const podCheckbox = screen.getByTestId('migration-candidate-pod');
    expect(podCheckbox).not.toBeChecked();
    expect(podCheckbox).toBeDisabled();
  });

  it('applies the migration for checked candidates only', async () => {
    const { dashboard, onApplied } = setup();

    // Uncheck job so only instance is migrated
    await userEvent.click(screen.getByTestId('migration-candidate-job'));
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));

    const variableNames = dashboard.state.$variables!.state.variables.map((variable) => variable.state.name);
    expect(variableNames).toEqual(['job', 'filter0']);

    const adHoc = dashboard.state.$variables!.state.variables.find(
      (variable) => variable instanceof AdHocFiltersVariable
    );
    expect(adHoc).toBeInstanceOf(AdHocFiltersVariable);
    expect((adHoc as AdHocFiltersVariable).state.filters).toEqual([
      { key: 'instance', operator: '=~', value: 'instance-value' },
    ]);

    expect(dashboard.state.overlay).toBeUndefined();
    expect(onApplied).toHaveBeenCalled();
    expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'alert-success' }));
  });

  it('closes without applying on cancel', async () => {
    const { dashboard, onApplied } = setup();

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    const variableNames = dashboard.state.$variables!.state.variables.map((variable) => variable.state.name);
    expect(variableNames).toEqual(['instance', 'job']);
    expect(dashboard.state.overlay).toBeUndefined();
    expect(onApplied).not.toHaveBeenCalled();
  });

  it('disables apply when nothing is selected', async () => {
    setup();

    await userEvent.click(screen.getByTestId('migration-candidate-instance'));
    await userEvent.click(screen.getByTestId('migration-candidate-job'));

    expect(screen.getByRole('button', { name: /^apply$/i })).toBeDisabled();
  });
});
