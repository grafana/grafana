import { render, screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';
import { CustomVariable, SceneGridLayout, SceneVariableSet, type SceneVariable } from '@grafana/scenes';

import { DashboardScene } from '../DashboardScene';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { type DashboardPlanningState } from '../types/dashboard';

import { PlanningControls } from './PlanningControls';

const { editDashboard } = selectors.components.NavToolbar;

describe('PlanningControls', () => {
  it('shows the preview label, plan title and the two actions', () => {
    setup();

    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('Prometheus overview')).toBeInTheDocument();
    expect(screen.getByTestId(editDashboard.planningDismissButton)).toBeInTheDocument();
    expect(screen.getByTestId(editDashboard.planningBuildButton)).toBeInTheDocument();
  });

  it("renders the plan's variables, which the user is being asked to approve", () => {
    setup([new CustomVariable({ name: 'handler', query: 'a,b', value: 'a', text: 'a' })]);

    expect(screen.getByText('handler')).toBeInTheDocument();
  });

  it('does not render the time picker, because placeholder panels have no queries', () => {
    // Same selector DashboardControls.test.tsx asserts the time picker *by*, so this cannot pass
    // by naming a control that never existed.
    setup([new CustomVariable({ name: 'handler', query: 'a,b', value: 'a', text: 'a' })]);

    expect(screen.queryByTestId(selectors.components.TimePicker.openButton)).not.toBeInTheDocument();
  });

  it('renders no variable content for a plan that declares none', () => {
    setup();

    // jsdom does not apply the CSS :empty rule; assert that VariableControls leaves
    // the row empty so the browser can collapse it.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText('handler')).not.toBeInTheDocument();
  });

  it('does not render the dashboard actions the plan stands in for', () => {
    setup();

    expect(screen.queryByTestId(editDashboard.saveButton)).not.toBeInTheDocument();
    expect(screen.queryByTestId(editDashboard.editButton)).not.toBeInTheDocument();
    expect(screen.queryByTestId(editDashboard.settingsButton)).not.toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.NavToolbar.shareDashboard)).not.toBeInTheDocument();
  });
});

function setup(variables: SceneVariable[] = []) {
  const planning: DashboardPlanningState = {
    planId: 'plan-1',
    planTitle: 'Prometheus overview',
    onBuild: jest.fn(),
    onDismiss: jest.fn(),
  };

  const dashboard = new DashboardScene({
    title: 'Prometheus overview',
    meta: {},
    body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [] }) }),
    $variables: new SceneVariableSet({ variables }),
    planning,
  });

  dashboard.activate();

  render(<PlanningControls dashboard={dashboard} planning={planning} />);

  return { dashboard };
}
