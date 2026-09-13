import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SceneGridLayout, SceneTimeRange } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { AddLink } from './AddLink';

const mockOpenAddLinkPane = jest.fn();
jest.mock('../../settings/links/LinkAddEditableElement', () => ({
  ...jest.requireActual('../../settings/links/LinkAddEditableElement'),
  openAddLinkPane: (...args: unknown[]) => mockOpenAddLinkPane(...args),
}));

function buildTestScene() {
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: true,
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [],
      }),
    }),
  });
  activateFullSceneTree(dashboard);
  return dashboard;
}

describe('AddLink', () => {
  beforeEach(() => {
    mockOpenAddLinkPane.mockClear();
  });

  it('opens the inline add-link pane when clicked', async () => {
    const user = userEvent.setup();
    const dashboard = buildTestScene();

    render(<AddLink dashboardScene={dashboard} />);

    await user.click(screen.getByRole('button', { name: /link/i }));

    expect(mockOpenAddLinkPane).toHaveBeenCalledTimes(1);
    expect(mockOpenAddLinkPane).toHaveBeenCalledWith(dashboard);
  });
});
