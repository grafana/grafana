import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, VizPanel, SceneVariableSet } from '@grafana/scenes';

import { activateFullSceneTree } from '../../utils/test-utils';
import { DashboardScene } from '../DashboardScene';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { LayoutParent } from '../types/LayoutParent';

import { DashboardLayoutSelector } from './DashboardLayoutSelector';

const switchLayoutMock = jest.fn();

setPluginImportUtils({
  importPanelPlugin: (_) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (_) => undefined,
});

describe('DashboardLayoutSelector', () => {
  it('should show confirmation modal when switching layouts', async () => {
    const user = userEvent.setup();
    const scene = buildTestScene();
    const layoutManager = scene.state.body;
    (layoutManager.parent as LayoutParent).switchLayout = switchLayoutMock;

    render(<DashboardLayoutSelector layoutManager={layoutManager} />);

    await user.click(screen.getByLabelText('layout-selection-option-Tabs'));

    const confirmButton = screen.getByRole('button', { name: 'Change layout' });

    expect(confirmButton).toBeInTheDocument();

    await user.click(confirmButton);
    expect(switchLayoutMock).toHaveBeenCalled();
  });
});

const buildTestScene = () => {
  const scene = new DashboardScene({
    title: 'testScene',
    editable: true,
    $variables: new SceneVariableSet({
      variables: [],
    }),
    body: new RowsLayoutManager({
      rows: [
        new RowItem({
          title: 'Row 1',
          layout: new DefaultGridLayoutManager({
            grid: new SceneGridLayout({
              children: [
                new DashboardGridItem({
                  body: new VizPanel({ key: 'panel-1', pluginId: 'text' }),
                }),
              ],
            }),
          }),
        }),
      ],
    }),
  });

  activateFullSceneTree(scene);
  return scene;
};
