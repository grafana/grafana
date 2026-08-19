import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, VizPanel, SceneVariableSet } from '@grafana/scenes';

import { activateFullSceneTree } from '../../utils/test-utils';
import { DashboardScene } from '../DashboardScene';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';

import { DashboardLayoutSelector } from './DashboardLayoutSelector';

setPluginImportUtils({
  importPanelPlugin: (_) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (_) => undefined,
});

describe('DashboardLayoutSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not show confirmation modal when switching tabs and rows layouts', async () => {
    const user = userEvent.setup();
    const scene = buildTestScene();
    const layoutManager = scene.state.body;
    const spy = jest.spyOn(scene, 'switchLayout');

    render(<DashboardLayoutSelector layoutManager={layoutManager} />);

    await user.click(screen.getByLabelText('layout-selection-option-Tabs'));
    expect(screen.queryByTestId(selectors.pages.ConfirmModal.delete)).not.toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
  });

  it('should show confirmation modal when switching grid layouts', async () => {
    const user = userEvent.setup();
    const scene = buildTestScene();
    const layoutManager = (scene.state.body as RowsLayoutManager).state.rows[0].state.layout;
    const layoutParent = (scene.state.body as RowsLayoutManager).state.rows[0];
    const spy = jest.spyOn(layoutParent, 'switchLayout');

    render(<DashboardLayoutSelector layoutManager={layoutManager} />);

    await user.click(screen.getByLabelText('layout-selection-option-Auto'));
    let confirmButton = screen.getByTestId(selectors.pages.ConfirmModal.delete);
    expect(confirmButton).toBeInTheDocument();

    await user.click(confirmButton);
    expect(spy).toHaveBeenCalled();
  });

  it('should disable tabs option when a row contains tabs layout and show correct message', async () => {
    const user = userEvent.setup();
    const scene = buildTestSceneWithNestedTabs();
    const layoutManager = scene.state.body;

    render(<DashboardLayoutSelector layoutManager={layoutManager} />);

    const tabsOption = screen.getByLabelText('layout-selection-option-Tabs');
    expect(tabsOption).toBeDisabled();

    await user.hover(tabsOption);
    expect(await screen.findByText('Cannot change to tabs because a row already contains tabs')).toBeInTheDocument();
  });

  it('should not disable tabs option when rows do not contain tabs', async () => {
    const scene = buildTestScene();
    const layoutManager = scene.state.body;

    render(<DashboardLayoutSelector layoutManager={layoutManager} />);

    const tabsOption = screen.getByLabelText('layout-selection-option-Tabs');
    expect(tabsOption).not.toBeDisabled();
  });

  it('should not disable tabs option when a rows layout sits under tabs -> rows (tabs -> rows -> tabs)', async () => {
    const innerRows = new RowsLayoutManager({
      rows: [new RowItem({ title: 'Inner row', layout: AutoGridLayoutManager.createEmpty() })],
    });
    const scene = new DashboardScene({
      title: 'testScene',
      editable: true,
      $variables: new SceneVariableSet({ variables: [] }),
      body: new TabsLayoutManager({
        tabs: [
          new TabItem({
            title: 'Tab 1',
            layout: new RowsLayoutManager({
              rows: [new RowItem({ title: 'Middle row', layout: innerRows })],
            }),
          }),
        ],
      }),
    });
    activateFullSceneTree(scene);

    render(<DashboardLayoutSelector layoutManager={innerRows} />);

    expect(screen.getByLabelText('layout-selection-option-Tabs')).not.toBeDisabled();
  });

  it('should disable tabs option when the closest enclosing group is tabs', async () => {
    const rows = new RowsLayoutManager({
      rows: [new RowItem({ title: 'Row 1', layout: AutoGridLayoutManager.createEmpty() })],
    });
    const scene = new DashboardScene({
      title: 'testScene',
      editable: true,
      $variables: new SceneVariableSet({ variables: [] }),
      body: new TabsLayoutManager({
        tabs: [new TabItem({ title: 'Tab 1', layout: rows })],
      }),
    });
    activateFullSceneTree(scene);

    render(<DashboardLayoutSelector layoutManager={rows} />);

    const tabsOption = screen.getByLabelText('layout-selection-option-Tabs');
    expect(tabsOption).toBeDisabled();
  });

  it('should not disable tabs option when tabs are nested deeper than a direct child row', async () => {
    const scene = new DashboardScene({
      title: 'testScene',
      editable: true,
      $variables: new SceneVariableSet({ variables: [] }),
      body: new RowsLayoutManager({
        rows: [
          new RowItem({
            title: 'Row 1',
            layout: new RowsLayoutManager({
              rows: [
                new RowItem({
                  title: 'Nested row',
                  layout: new TabsLayoutManager({
                    tabs: [new TabItem({ title: 'Tab 1', layout: AutoGridLayoutManager.createEmpty() })],
                  }),
                }),
              ],
            }),
          }),
        ],
      }),
    });
    activateFullSceneTree(scene);

    render(<DashboardLayoutSelector layoutManager={scene.state.body} />);

    expect(screen.getByLabelText('layout-selection-option-Tabs')).not.toBeDisabled();
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

const buildTestSceneWithNestedTabs = () => {
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
        new RowItem({
          title: 'Row with Tabs',
          layout: new TabsLayoutManager({
            tabs: [
              new TabItem({
                title: 'Tab 1',
                layout: AutoGridLayoutManager.createEmpty(),
              }),
            ],
          }),
        }),
      ],
    }),
  });

  activateFullSceneTree(scene);
  return scene;
};
