import { act, render, screen } from '@testing-library/react';

import {
  SceneDataNode,
  SceneDataTransformer,
  SceneFlexLayout,
  SceneGridLayout,
  SceneQueryRunner,
  VizPanel,
  type SceneDataProvider,
} from '@grafana/scenes';

import { DashboardScene } from './DashboardScene';
import { PlanPlaceholderBadge } from './PlanPlaceholderBadge';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

describe('PlanPlaceholderBadge', () => {
  it('removes the sample data label when planning ends', () => {
    const { dashboard } = setup(new SceneDataNode({}));

    expect(screen.getByText('Sample data')).toBeInTheDocument();

    act(() => dashboard.setState({ planning: undefined }));

    expect(screen.queryByText('Sample data')).not.toBeInTheDocument();
  });

  it('removes the sample data label when a query runner replaces the sample', () => {
    const { panel } = setup(new SceneDataNode({}));

    expect(screen.getByText('Sample data')).toBeInTheDocument();

    act(() => panel.setState({ $data: new SceneQueryRunner({ queries: [], runQueriesMode: 'manual' }) }));

    expect(screen.queryByText('Sample data')).not.toBeInTheDocument();
  });

  it('does not label data from a query runner wrapped in a transformer as sample data', () => {
    setup(
      new SceneDataTransformer({
        $data: new SceneQueryRunner({ queries: [], runQueriesMode: 'manual' }),
        transformations: [],
      })
    );

    expect(screen.queryByText('Sample data')).not.toBeInTheDocument();
  });

  it('does not show a sample data label for a panel with no data provider', () => {
    setup();

    expect(screen.queryByText('Sample data')).not.toBeInTheDocument();
  });

  it('does not show a sample data label outside a dashboard', () => {
    const badge = new PlanPlaceholderBadge();
    const panel = new VizPanel({ pluginId: 'timeseries', titleItems: [badge], $data: new SceneDataNode({}) });
    const root = new SceneFlexLayout({ children: [panel] });

    render(<badge.Component model={badge} />);

    expect(badge.getRoot()).toBe(root);
    expect(screen.queryByText('Sample data')).not.toBeInTheDocument();
  });
});

function setup($data?: SceneDataProvider) {
  const badge = new PlanPlaceholderBadge();
  const panel = new VizPanel({ pluginId: 'timeseries', titleItems: [badge], $data });
  const dashboard = new DashboardScene({
    title: 'Plan',
    meta: {},
    body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [] }) }),
    planning: {
      planId: 'plan-1',
      planTitle: 'Plan',
      panelCount: 1,
      onBuild: jest.fn(),
      onDismiss: jest.fn(),
    },
  });
  dashboard.state.body.addPanel(panel);

  render(<badge.Component model={badge} />);

  return { dashboard, panel };
}
