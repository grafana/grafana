import { fireEvent, render, screen, waitFor } from 'test/test-utils';

import { getDefaultTimeRange, LoadingState, toDataFrame } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime/unstable';
import { SceneQueryRunner, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { tryGetExploreUrlForPanel } from 'app/features/dashboard-scene/utils/urlBuilders';
import { getAllSuggestions } from 'app/features/panel/suggestions/getAllSuggestions';
import { GrafanaQueryType } from 'app/plugins/datasource/grafana/types';

import { NotebookCellItem } from './NotebookCellItem';
import { NotebookLayoutManager } from './NotebookLayoutManager';
import { NotebookPanelActions } from './NotebookPanelActions';

jest.mock('app/features/dashboard-scene/utils/urlBuilders', () => ({
  tryGetExploreUrlForPanel: jest.fn(),
}));
jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(),
}));
jest.mock('app/features/panel/suggestions/getAllSuggestions', () => ({
  getAllSuggestions: jest.fn(),
}));
jest.mock('app/features/panel/components/VizTypePicker/VisualizationSuggestionCard', () => ({
  VisualizationSuggestionCard: ({ suggestion }: { suggestion: { name: string } }) => <div>{suggestion.name}</div>,
}));

function buildPanelCell() {
  const panel = new VizPanel({
    key: 'panel-1',
    title: 'Latency',
    pluginId: 'timeseries',
    $data: new SceneQueryRunner({ queries: [{ refId: 'A', datasource: { uid: 'prometheus' } }] }),
  });
  const cell = new NotebookCellItem({ elementName: 'latency', source: 'user', body: panel });
  new NotebookLayoutManager({
    cells: [cell],
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
  });
  return { cell, panel };
}

describe('NotebookPanelActions', () => {
  beforeEach(() => {
    jest.mocked(tryGetExploreUrlForPanel).mockResolvedValue('/explore?panel=1');
    jest.mocked(getDataSourceInstance).mockImplementation(
      async (ref) =>
        ({
          uid: (typeof ref === 'string' ? ref : ref?.uid) ?? 'grafana',
        }) as Awaited<ReturnType<typeof getDataSourceInstance>>
    );
  });

  it('offers only Explore in view mode', async () => {
    const { cell, panel } = buildPanelCell();
    render(<NotebookPanelActions cell={cell} panel={panel} isEditing={false} />);

    const explore = await screen.findByRole('link', { name: 'Open in Explore' });
    expect(explore).toHaveAttribute('href', '/explore?panel=1');
    expect(explore).toHaveAttribute('target', '_blank');
    expect(screen.queryByRole('button', { name: 'Edit panel title' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change visualization' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duplicate block' })).not.toBeInTheDocument();
    expect(tryGetExploreUrlForPanel).toHaveBeenCalledWith(panel, (panel.state.$data as SceneQueryRunner).state.queries);
  });

  it('adds the Grafana default query type to the Explore link without changing the panel query', async () => {
    const { cell, panel } = buildPanelCell();
    const runner = panel.state.$data as SceneQueryRunner;
    runner.setState({ queries: [{ refId: 'A', datasource: { uid: 'grafana', type: 'datasource' } }] });

    render(<NotebookPanelActions cell={cell} panel={panel} isEditing={false} />);

    await screen.findByRole('link', { name: 'Open in Explore' });
    expect(tryGetExploreUrlForPanel).toHaveBeenCalledWith(panel, [
      { refId: 'A', datasource: { uid: 'grafana', type: 'datasource' }, queryType: GrafanaQueryType.RandomWalk },
    ]);
    expect(runner.state.queries[0]).not.toHaveProperty('queryType');
  });

  it('resolves the default datasource before building the Explore link', async () => {
    const { cell, panel } = buildPanelCell();
    const runner = panel.state.$data as SceneQueryRunner;
    runner.setState({ queries: [{ refId: 'A' }] });

    render(<NotebookPanelActions cell={cell} panel={panel} isEditing={false} />);

    await screen.findByRole('link', { name: 'Open in Explore' });
    expect(tryGetExploreUrlForPanel).toHaveBeenCalledWith(panel, [
      { refId: 'A', queryType: GrafanaQueryType.RandomWalk },
    ]);
    expect(runner.state.queries[0]).not.toHaveProperty('queryType');
  });

  it('preserves explicitly selected Grafana query types in the Explore link', async () => {
    const { cell, panel } = buildPanelCell();
    const runner = panel.state.$data as SceneQueryRunner;
    runner.setState({
      queries: [
        { refId: 'A', datasource: { uid: 'grafana', type: 'datasource' }, queryType: GrafanaQueryType.Annotations },
      ],
    });

    render(<NotebookPanelActions cell={cell} panel={panel} isEditing={false} />);

    await screen.findByRole('link', { name: 'Open in Explore' });
    expect(tryGetExploreUrlForPanel).toHaveBeenCalledWith(panel, runner.state.queries);
  });

  it('groups panel and block actions in edit mode', async () => {
    const { cell, panel } = buildPanelCell();
    const onDuplicate = jest.fn();
    const onDelete = jest.fn();
    render(
      <NotebookPanelActions cell={cell} panel={panel} isEditing={true} onDuplicate={onDuplicate} onDelete={onDelete} />
    );

    await screen.findByRole('link', { name: 'Open in Explore' });
    const toolbar = screen.getByRole('button', { name: 'Edit panel title' }).closest('[data-notebook-panel-actions]');
    expect(toolbar).toContainElement(screen.getByRole('button', { name: 'Change visualization' }));
    expect(toolbar).toContainElement(screen.getByRole('link', { name: 'Open in Explore' }));
    expect(toolbar).toContainElement(screen.getByRole('button', { name: 'Duplicate block' }));
    expect(toolbar).toContainElement(screen.getByRole('button', { name: 'Delete block' }));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate block' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete block' }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('toggles the query editor when available', async () => {
    const { cell, panel } = buildPanelCell();
    const onToggleQueryEditor = jest.fn();
    render(
      <NotebookPanelActions
        cell={cell}
        panel={panel}
        isEditing={true}
        onToggleQueryEditor={onToggleQueryEditor}
        queryEditorOpen={false}
      />
    );

    await screen.findByRole('link', { name: 'Open in Explore' });
    expect(screen.getByRole('button', { name: 'Edit query' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Edit query' }));
    expect(onToggleQueryEditor).toHaveBeenCalledTimes(1);
  });

  it('keeps a manually chosen visualization when the unchanged query is run', async () => {
    const { cell, panel } = buildPanelCell();
    const runner = panel.state.$data as SceneQueryRunner;
    runner.setState({
      data: {
        state: LoadingState.Done,
        series: [toDataFrame({ fields: [{ name: 'value', values: [1] }] })],
        timeRange: getDefaultTimeRange(),
      },
    });
    jest.mocked(getAllSuggestions).mockResolvedValue({
      suggestions: [{ name: 'Table', pluginId: 'table', hash: 'table', options: {} }],
      hasErrors: false,
    });
    jest.spyOn(cell, 'onVisualizationChange').mockResolvedValue(undefined);
    const lastSuggestedQuery = { current: undefined };
    const autoSuggest = { current: true };
    const { user } = render(
      <NotebookPanelActions
        cell={cell}
        panel={panel}
        isEditing={true}
        lastSuggestedQuery={lastSuggestedQuery}
        autoSuggest={autoSuggest}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Change visualization' }));
    await user.click(await screen.findByRole('button', { name: 'Table' }));

    await waitFor(() => expect(lastSuggestedQuery.current).toBe(runner.state.queries[0]));
    expect(autoSuggest.current).toBe(false);
    expect(cell.onVisualizationChange).toHaveBeenCalledWith(expect.objectContaining({ pluginId: 'table' }));
  });

  it('lets keyboard users choose a visualization suggestion', async () => {
    const { cell, panel } = buildPanelCell();
    const runner = panel.state.$data as SceneQueryRunner;
    runner.setState({
      data: {
        state: LoadingState.Done,
        series: [toDataFrame({ fields: [{ name: 'value', values: [1] }] })],
        timeRange: getDefaultTimeRange(),
      },
    });
    jest.mocked(getAllSuggestions).mockResolvedValue({
      suggestions: [{ name: 'Table', pluginId: 'table', hash: 'table', options: {} }],
      hasErrors: false,
    });
    jest.spyOn(cell, 'onVisualizationChange').mockResolvedValue(undefined);
    const { user } = render(<NotebookPanelActions cell={cell} panel={panel} isEditing={true} />);

    fireEvent.click(screen.getByRole('button', { name: 'Change visualization' }));
    const suggestion = await screen.findByRole('button', { name: 'Table' });
    suggestion.focus();
    await user.keyboard('{Enter}');

    expect(cell.onVisualizationChange).toHaveBeenCalledWith(expect.objectContaining({ pluginId: 'table' }));
  });

  it('updates the panel title while editing', async () => {
    const { cell, panel } = buildPanelCell();
    const { user } = render(<NotebookPanelActions cell={cell} panel={panel} isEditing={true} />);

    expect(screen.getByRole('button', { name: 'Change visualization' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit panel title' }));
    const title = screen.getByRole('textbox', { name: 'Panel title' });
    expect(
      screen.getByRole('button', { name: 'Edit panel title' }).closest('[data-notebook-panel-actions]')
    ).not.toContainElement(title);
    await user.clear(title);
    await user.type(title, 'Error rate{Enter}');

    expect(panel.state.title).toBe('Error rate');
    expect(screen.queryByRole('textbox', { name: 'Panel title' })).not.toBeInTheDocument();
  });

  it('restores the previous title when rename is cancelled', async () => {
    const { cell, panel } = buildPanelCell();
    const { user } = render(<NotebookPanelActions cell={cell} panel={panel} isEditing={true} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit panel title' }));
    const title = screen.getByRole('textbox', { name: 'Panel title' });
    await user.clear(title);
    await user.type(title, 'Errors{Escape}');

    expect(panel.state.title).toBe('Latency');
    expect(screen.queryByRole('textbox', { name: 'Panel title' })).not.toBeInTheDocument();
  });
});
