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

// Mocked below tryGetExploreUrlForPanel rather than at it, so the range resolution stays real.
jest.mock('app/core/utils/explore', () => ({
  ...jest.requireActual('app/core/utils/explore'),
  getExploreUrl: jest.fn(),
}));

const mockGetExploreUrl = jest.mocked(getExploreUrl);

function panelKind(timeFrom?: string) {
  const kind = defaultVisualizationPanelKind();
  if (!timeFrom) {
    return kind;
  }

  return {
    ...kind,
    spec: {
      ...kind.spec,
      data: {
        ...kind.spec.data,
        spec: { ...kind.spec.data.spec, queryOptions: { ...kind.spec.data.spec.queryOptions, timeFrom } },
      },
    },
  };
}

/**
 * A real Panel VizPanel in its cell under a notebook scene carrying a $timeRange — the graph this
 * button reads from. `timeFrom` seeds queryOptions so buildVizPanelState builds the PanelTimeRange,
 * rather than the test attaching one by hand.
 */
function buildPanel({ queries, timeFrom }: { queries?: Array<Record<string, unknown>>; timeFrom?: string } = {}) {
  const panel = new VizPanel(buildVizPanelState(panelKind(timeFrom), 1));

  const runner = getQueryRunnerFor(panel)!;
  if (queries) {
    const base = runner.state.queries[0];
    setQueryRunnerQueries(
      runner,
      queries.map((query, i) => ({ ...base, refId: String.fromCharCode(65 + i), ...query }) as DataQuery)
    );
  }

  const cell = new NotebookCellItem({ elementName: 'query-1', source: 'user', body: panel });
  const scene = new NotebookScene({
    title: 'Test notebook',
    body: new NotebookLayoutManager({ cells: [cell] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });

  // Not activateFullSceneTree: that would also start the SceneQueryRunner, which runs its queries
  // against a datasource jsdom has none of. A PanelTimeRange holds a default range until activated.
  panel.state.$timeRange?.activate();

  return { panel, runner, scene };
}

beforeEach(() => {
  jest.spyOn(contextSrv, 'hasAccessToExplore').mockReturnValue(true);
  mockGetExploreUrl.mockReset().mockResolvedValue('/explore?panes=%7B%7D&schemaVersion=1');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('OpenInExploreButton', () => {
  it('links to Explore in a new tab', async () => {
    const { panel } = buildPanel();

    render(<OpenInExploreButton panel={panel} />);

    const link = await screen.findByRole('link', { name: 'Explore' });
    expect(link).toHaveAttribute('href', '/explore?panes=%7B%7D&schemaVersion=1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('hands Explore the panel queries and its datasource', async () => {
    const { panel } = buildPanel({ queries: [{ expr: 'up', datasource: { uid: 'prom-1', type: 'prometheus' } }] });

    render(<OpenInExploreButton panel={panel} />);

    await waitFor(() => expect(mockGetExploreUrl).toHaveBeenCalled());
    expect(mockGetExploreUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        queries: [expect.objectContaining({ refId: 'A', expr: 'up' })],
        dsRef: { uid: 'prom-1', type: 'prometheus' },
      })
    );
  });

  // Both branches fall out of sceneGraph.getTimeRange, which is why no range is computed here.
  it('uses the notebook range when the panel has no override', async () => {
    const { panel } = buildPanel();

    render(<OpenInExploreButton panel={panel} />);

    await waitFor(() => expect(mockGetExploreUrl).toHaveBeenCalled());
    expect(mockGetExploreUrl.mock.calls[0][0].timeRange.raw).toEqual({ from: 'now-6h', to: 'now' });
  });

  it("uses the panel's own range when it overrides the notebook's", async () => {
    const { panel } = buildPanel({ timeFrom: 'now-1h' });

    render(<OpenInExploreButton panel={panel} />);

    await waitFor(() => expect(mockGetExploreUrl).toHaveBeenCalled());
    expect(mockGetExploreUrl.mock.calls[0][0].timeRange.raw).toEqual({ from: 'now-1h', to: 'now' });
  });

  it('rebuilds the link when a query changes', async () => {
    const { panel, runner } = buildPanel({ queries: [{ expr: 'up' }] });

    render(<OpenInExploreButton panel={panel} />);
    await waitFor(() => expect(mockGetExploreUrl).toHaveBeenCalled());

    mockGetExploreUrl.mockClear();
    act(() => setQueryRunnerQueries(runner, [{ ...runner.state.queries[0], expr: 'down' } as DataQuery]));

    await waitFor(() =>
      expect(mockGetExploreUrl).toHaveBeenCalledWith(
        expect.objectContaining({ queries: [expect.objectContaining({ expr: 'down' })] })
      )
    );
  });

  it('renders nothing for a reader without access to Explore', async () => {
    jest.spyOn(contextSrv, 'hasAccessToExplore').mockReturnValue(false);
    const { panel } = buildPanel();

    render(<OpenInExploreButton panel={panel} />);

    await waitFor(() => expect(mockGetExploreUrl).not.toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: 'Explore' })).not.toBeInTheDocument();
  });
});
