import { act } from 'react';
import { render, screen, waitFor } from 'test/test-utils';

import { type DataQuery } from '@grafana/data';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';
import { getExploreUrl } from 'app/core/utils/explore';
import { buildVizPanelState } from 'app/features/dashboard-scene/serialization/layoutSerializers/utils';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/getQueryRunnerFor';
import { defaultVisualizationPanelKind } from 'app/features/notebook/types';

import { NotebookScene } from '../NotebookScene';

import { NotebookCellItem } from './NotebookCellItem';
import { NotebookLayoutManager } from './NotebookLayoutManager';
import { OpenInExploreButton } from './OpenInExploreButton';
import { setQueryRunnerQueries } from './setQueryRunnerQueries';

jest.mock('app/core/utils/explore', () => ({
  ...jest.requireActual('app/core/utils/explore'),
  getExploreUrl: jest.fn(),
}));

const mockGetExploreUrl = jest.mocked(getExploreUrl);

/** A VizPanel sitting in a cell under a notebook scene, so sceneGraph.getTimeRange has somewhere to resolve to. */
function buildPanel(queries?: Array<Record<string, unknown>>) {
  const panel = new VizPanel(buildVizPanelState(defaultVisualizationPanelKind(), 1));
  const runner = getQueryRunnerFor(panel)!;

  if (queries) {
    const base = runner.state.queries[0];
    setQueryRunnerQueries(
      runner,
      queries.map((query, i) => ({ ...base, refId: String.fromCharCode(65 + i), ...query }) as DataQuery)
    );
  }

  const cell = new NotebookCellItem({ elementName: 'panel-1', source: 'user', body: panel });
  new NotebookScene({
    title: 'Test notebook',
    body: new NotebookLayoutManager({ cells: [cell] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });

  return { panel, runner };
}

beforeEach(() => {
  jest.spyOn(contextSrv, 'hasAccessToExplore').mockReturnValue(true);
  mockGetExploreUrl.mockReset().mockResolvedValue('/explore?first');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('OpenInExploreButton', () => {
  it('links to Explore in a new tab', async () => {
    const { panel } = buildPanel();

    render(<OpenInExploreButton panel={panel} />);

    const link = await screen.findByRole('link', { name: 'Open in Explore' });
    expect(link).toHaveAttribute('href', '/explore?first');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('hands Explore the panel queries, its datasource and the notebook time range', async () => {
    const { panel } = buildPanel([{ expr: 'up', datasource: { uid: 'prom-1', type: 'prometheus' } }]);

    render(<OpenInExploreButton panel={panel} />);

    await waitFor(() => expect(mockGetExploreUrl).toHaveBeenCalled());
    expect(mockGetExploreUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        queries: [expect.objectContaining({ refId: 'A', expr: 'up' })],
        dsRef: { uid: 'prom-1', type: 'prometheus' },
        timeRange: expect.objectContaining({ raw: { from: 'now-6h', to: 'now' } }),
      })
    );
  });

  it('renders nothing while the panel has no query runner yet', () => {
    const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries' });
    const cell = new NotebookCellItem({ elementName: 'panel-1', source: 'user', body: panel });
    new NotebookScene({
      title: 'Test notebook',
      body: new NotebookLayoutManager({ cells: [cell] }),
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      timePicker: new SceneTimePicker({}),
      refreshPicker: new SceneRefreshPicker({}),
    });

    render(<OpenInExploreButton panel={panel} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('rebuilds the link when a query changes', async () => {
    const { panel, runner } = buildPanel([{ expr: 'up' }]);

    render(<OpenInExploreButton panel={panel} />);
    expect(await screen.findByRole('link', { name: 'Open in Explore' })).toHaveAttribute('href', '/explore?first');

    mockGetExploreUrl.mockResolvedValue('/explore?second');
    act(() => setQueryRunnerQueries(runner, [{ ...runner.state.queries[0], expr: 'down' } as DataQuery]));

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Open in Explore' })).toHaveAttribute('href', '/explore?second')
    );
  });

  it('renders nothing without access to Explore', async () => {
    jest.spyOn(contextSrv, 'hasAccessToExplore').mockReturnValue(false);
    const { panel } = buildPanel();

    render(<OpenInExploreButton panel={panel} />);

    await waitFor(() => expect(mockGetExploreUrl).not.toHaveBeenCalled());
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
