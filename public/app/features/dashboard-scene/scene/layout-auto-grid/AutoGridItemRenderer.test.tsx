import { act } from '@testing-library/react';
import { render, screen } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

import { activateFullSceneTree } from '../../utils/test-utils';
import { DashboardScene } from '../DashboardScene';

import { AutoGridItem } from './AutoGridItem';
import { AutoGridLayout } from './AutoGridLayout';
import { AutoGridLayoutManager } from './AutoGridLayoutManager';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

const RESIZE_DISABLED_LABEL = 'Panels cannot be resized in auto layout';

function buildTestScene({ isEditing }: { isEditing: boolean }) {
  const panel = new VizPanel({ title: 'Panel 1', key: 'panel-1', pluginId: 'table' });
  const gridItem = new AutoGridItem({ key: 'grid-item-1', body: panel });
  const manager = new AutoGridLayoutManager({
    key: 'test-AutoGridLayoutManager',
    layout: new AutoGridLayout({ children: [gridItem] }),
  });
  const dashboard = new DashboardScene({ body: manager, isEditing });

  activateFullSceneTree(dashboard);

  return { dashboard, gridItem };
}

async function renderItem(isEditing: boolean) {
  const { gridItem } = buildTestScene({ isEditing });
  render(<gridItem.Component model={gridItem} />);
  // The VizPanel loads its plugin asynchronously; flush so the resulting state
  // update settles inside act() and does not trigger console warnings.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('AutoGridItemRenderer', () => {
  it('shows the resize-disabled hint while editing', async () => {
    await renderItem(true);

    expect(screen.getByLabelText(RESIZE_DISABLED_LABEL)).toBeInTheDocument();
  });

  it('does not show the resize-disabled hint when not editing', async () => {
    await renderItem(false);

    expect(screen.queryByLabelText(RESIZE_DISABLED_LABEL)).not.toBeInTheDocument();
  });
});
