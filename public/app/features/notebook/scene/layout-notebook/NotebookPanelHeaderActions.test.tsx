import { render, screen } from 'test/test-utils';

import { SceneQueryRunner, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';
import { getExploreUrl } from 'app/core/utils/explore';
import { LibraryPanelBehavior } from 'app/features/dashboard-scene/scene/LibraryPanelBehavior';

import { NotebookCellItem } from './NotebookCellItem';
import { NotebookLayoutManager } from './NotebookLayoutManager';
import { NotebookPanelHeaderActions } from './NotebookPanelHeaderActions';

jest.mock('app/core/utils/explore', () => ({
  ...jest.requireActual('app/core/utils/explore'),
  getExploreUrl: jest.fn(),
}));

function buildPanelCell(behaviors?: VizPanel['state']['$behaviors']) {
  const panel = new VizPanel({
    key: 'panel-1',
    pluginId: 'timeseries',
    $data: new SceneQueryRunner({ queries: [{ refId: 'A', datasource: { uid: 'prometheus' } }] }),
    $behaviors: behaviors,
  });
  const cell = new NotebookCellItem({ elementName: 'panel-1', source: 'user', body: panel });
  new NotebookLayoutManager({ cells: [cell], $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }) });

  return { cell, panel };
}

beforeEach(() => {
  jest.spyOn(contextSrv, 'hasAccessToExplore').mockReturnValue(true);
  jest.mocked(getExploreUrl).mockResolvedValue('/explore?panel=1');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('NotebookPanelHeaderActions', () => {
  it('offers only Explore in view mode', async () => {
    const { cell, panel } = buildPanelCell();
    render(<NotebookPanelHeaderActions cell={cell} panel={panel} isEditing={false} />);

    await screen.findByRole('link', { name: 'Open in Explore' });
    expect(screen.queryByRole('button', { name: 'Change visualization' })).not.toBeInTheDocument();
  });

  it('also offers the visualization picker while editing', async () => {
    const { cell, panel } = buildPanelCell();
    render(<NotebookPanelHeaderActions cell={cell} panel={panel} isEditing={true} />);

    await screen.findByRole('link', { name: 'Open in Explore' });
    expect(screen.getByRole('button', { name: 'Change visualization' })).toBeInTheDocument();
  });

  it('never offers the visualization picker for a library panel, even while editing', async () => {
    const { cell, panel } = buildPanelCell([new LibraryPanelBehavior({ uid: 'lp-1', name: 'Shared panel' })]);
    render(<NotebookPanelHeaderActions cell={cell} panel={panel} isEditing={true} />);

    await screen.findByRole('link', { name: 'Open in Explore' });
    expect(screen.queryByRole('button', { name: 'Change visualization' })).not.toBeInTheDocument();
  });
});
