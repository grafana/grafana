import { MockDataSourceApi } from 'test/mocks/datasource_srv';
import { act, fireEvent, render, screen, waitFor, within } from 'test/test-utils';

import { CoreApp, getDefaultTimeRange, LoadingState, toDataFrame } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime';
import { SceneQueryRunner, SceneReactObject, SceneTimeRange, type SceneObject, VizPanel } from '@grafana/scenes';
import { tryGetExploreUrlForPanel } from 'app/features/dashboard-scene/utils/urlBuilders';
import { getAllSuggestions } from 'app/features/panel/suggestions/getAllSuggestions';

import { NotebookCellItem } from './NotebookCellItem';
import { NotebookLayoutManager } from './NotebookLayoutManager';
import { NotebookPanelActions } from './NotebookPanelActions';

jest.mock('app/features/dashboard-scene/utils/urlBuilders', () => ({
  tryGetExploreUrlForPanel: jest.fn(),
}));
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceInstance: jest.fn(),
}));
jest.mock('app/features/panel/suggestions/getAllSuggestions', () => ({
  getAllSuggestions: jest.fn(),
}));
jest.mock('app/features/panel/components/VizTypePicker/VisualizationSuggestionCard', () => ({
  VisualizationSuggestionCard: () => <div>Visualization preview</div>,
}));

function buildPanelCell(title = 'Latency') {
  const panel = new VizPanel({
    key: 'panel-1',
    title,
    hoverHeader: !title,
    titleItems: [],
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

function renderTitleAction(panel: VizPanel) {
  const titleAction = (panel.state.titleItems as SceneObject[]).find(
    (item): item is SceneReactObject => item instanceof SceneReactObject
  );
  expect(titleAction).toBeDefined();
  const TitleAction = titleAction!.Component;
  return render(<TitleAction model={titleAction!} />);
}

const getDefaultQuery = jest.fn();

describe('NotebookPanelActions', () => {
  beforeEach(() => {
    getDefaultQuery.mockReset().mockReturnValue({ queryType: 'randomWalk' });
    jest.mocked(tryGetExploreUrlForPanel).mockResolvedValue('/explore?panel=1');
    jest.mocked(getDataSourceInstance).mockImplementation(async (ref) =>
      Object.assign(new MockDataSourceApi(), {
        uid: (typeof ref === 'string' ? ref : ref?.uid) ?? 'grafana',
        getDefaultQuery,
      })
    );
  });

  it('offers only Explore in view mode', async () => {
    const { cell, panel } = buildPanelCell();
    render(<NotebookPanelActions cell={cell} panel={panel} isEditing={false} />);

    const explore = await screen.findByRole('link', { name: 'Open in Explore' });
    expect(explore).toHaveAttribute('href', '/explore?panel=1');
    expect(explore).toHaveAttribute('target', '_blank');
    expect(screen.queryByRole('button', { name: 'Edit panel title' })).not.toBeInTheDocument();
    expect(panel.state.titleItems).toEqual([]);
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
      { refId: 'A', datasource: { uid: 'grafana', type: 'datasource' }, queryType: 'randomWalk' },
    ]);
    expect(getDefaultQuery).toHaveBeenCalledWith(CoreApp.Explore);
    expect(runner.state.queries[0]).not.toHaveProperty('queryType');
  });

  it('resolves the default datasource before building the Explore link', async () => {
    const { cell, panel } = buildPanelCell();
    const runner = panel.state.$data as SceneQueryRunner;
    runner.setState({ queries: [{ refId: 'A' }] });

    render(<NotebookPanelActions cell={cell} panel={panel} isEditing={false} />);

    await screen.findByRole('link', { name: 'Open in Explore' });
    expect(tryGetExploreUrlForPanel).toHaveBeenCalledWith(panel, [{ refId: 'A', queryType: 'randomWalk' }]);
    expect(runner.state.queries[0]).not.toHaveProperty('queryType');
  });

  it('preserves explicitly selected Grafana query types in the Explore link', async () => {
    const { cell, panel } = buildPanelCell();
    const runner = panel.state.$data as SceneQueryRunner;
    runner.setState({
      queries: [{ refId: 'A', datasource: { uid: 'grafana', type: 'datasource' }, queryType: 'annotations' }],
    });

    render(<NotebookPanelActions cell={cell} panel={panel} isEditing={false} />);

    await screen.findByRole('link', { name: 'Open in Explore' });
    expect(tryGetExploreUrlForPanel).toHaveBeenCalledWith(panel, runner.state.queries);
  });

  it('groups visualization controls with a shared block menu in edit mode', async () => {
    const { cell, panel } = buildPanelCell();
    const onDuplicate = jest.fn();
    const onDelete = jest.fn();
    render(
      <NotebookPanelActions cell={cell} panel={panel} isEditing={true} onDuplicate={onDuplicate} onDelete={onDelete} />
    );

    await screen.findByRole('link', { name: 'Open in Explore' });
    renderTitleAction(panel);
    const toolbar = screen
      .getByRole('button', { name: 'Change visualization' })
      .closest('[data-notebook-panel-actions]');
    expect(toolbar).not.toContainElement(screen.getByRole('button', { name: 'Edit panel title' }));
    expect(toolbar).toContainElement(screen.getByRole('button', { name: 'Change visualization' }));
    expect(toolbar).toContainElement(screen.getByRole('link', { name: 'Open in Explore' }));
    expect(toolbar).toContainElement(screen.getByRole('button', { name: 'Block actions' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Block actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Duplicate block' }));
    fireEvent.click(screen.getByRole('button', { name: 'Block actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete block' }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it.each(['react', 'scene', 'array'] as const)(
    'preserves %s header actions and title controls',
    async (representation) => {
      const { cell, panel } = buildPanelCell();
      const headerNode = <span>Existing header action</span>;
      const headerObject = new SceneReactObject({ reactNode: headerNode });
      const existingHeader =
        representation === 'react' ? headerNode : representation === 'scene' ? headerObject : [headerObject];
      const existingTitle = new SceneReactObject({ reactNode: <span>Existing title control</span> });
      panel.setState({ headerActions: existingHeader, titleItems: [existingTitle] });
      const { unmount } = render(<NotebookPanelActions cell={cell} panel={panel} isEditing={true} />);
      const header = render(
        <div data-testid="panel-header">
          {(panel.state.headerActions as SceneObject[]).map((action, index) => (
            <action.Component key={index} model={action} />
          ))}
        </div>
      );

      const toolbar = await screen.findByRole('button', { name: 'Change visualization' });
      expect(screen.getByTestId('panel-header')).toContainElement(toolbar);
      expect(screen.getByTestId('panel-header')).toContainElement(screen.getByText('Existing header action'));
      expect(panel.state.titleItems).toContain(existingTitle);
      if (representation !== 'react') {
        expect(headerObject.parent).toBe(panel);
      }

      unmount();
      expect(panel.state.headerActions).toBe(existingHeader);
      expect(panel.state.titleItems).toEqual([existingTitle]);
      header.unmount();
    }
  );

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
    const suggestion = await screen.findByRole('button', { name: 'Table' });
    expect(within(suggestion).getByText('Table')).toBeVisible();
    await user.click(suggestion);

    await waitFor(() => expect(lastSuggestedQuery.current).toBe(runner.state.queries[0]));
    expect(autoSuggest.current).toBe(false);
    expect(cell.onVisualizationChange).toHaveBeenCalledWith(expect.objectContaining({ pluginId: 'table' }));
    expect(screen.queryByRole('button', { name: 'Table' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change visualization' })).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Change visualization' }));
    expect(await screen.findByRole('button', { name: 'Table' })).toBeInTheDocument();
  });

  it('lets users retry a failed visualization change', async () => {
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
    const changeVisualization = jest
      .spyOn(cell, 'onVisualizationChange')
      .mockRejectedValueOnce(new Error('Plugin failed'))
      .mockResolvedValueOnce(undefined);
    const { user } = render(<NotebookPanelActions cell={cell} panel={panel} isEditing={true} />);

    fireEvent.click(screen.getByRole('button', { name: 'Change visualization' }));
    await user.click(await screen.findByRole('button', { name: 'Table' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not change visualization. Try again.');
    expect(panel.state.pluginId).toBe('timeseries');
    await user.click(screen.getByRole('button', { name: 'Table' }));

    await waitFor(() => expect(changeVisualization).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Change visualization' })).toHaveAttribute('aria-expanded', 'false')
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
    render(<NotebookPanelActions cell={cell} panel={panel} isEditing={true} />);

    fireEvent.click(screen.getByRole('button', { name: 'Change visualization' }));
    const suggestion = await screen.findByRole('button', { name: 'Table' });
    fireEvent.keyDown(suggestion, { key: 'Enter' });

    await waitFor(() => {
      expect(cell.onVisualizationChange).toHaveBeenCalledWith(expect.objectContaining({ pluginId: 'table' }));
      expect(screen.queryByRole('button', { name: 'Table' })).not.toBeInTheDocument();
    });
  });

  it('updates the panel title while editing', async () => {
    const { cell, panel } = buildPanelCell();
    const { user } = render(<NotebookPanelActions cell={cell} panel={panel} isEditing={true} />);

    expect(screen.getByRole('button', { name: 'Change visualization' })).toBeInTheDocument();
    renderTitleAction(panel);
    fireEvent.click(screen.getByRole('button', { name: 'Edit panel title' }));
    const title = screen.getByRole('textbox', { name: 'Panel title' });
    expect(
      screen.getByRole('button', { name: 'Change visualization' }).closest('[data-notebook-panel-actions]')
    ).not.toContainElement(title);
    await user.clear(title);
    await user.type(title, 'Error rate{Enter}');

    expect(panel.state.title).toBe('Error rate');
    expect(screen.queryByRole('textbox', { name: 'Panel title' })).not.toBeInTheDocument();
  });

  it('restores the previous title when rename is cancelled', async () => {
    const { cell, panel } = buildPanelCell();
    const { user } = render(<NotebookPanelActions cell={cell} panel={panel} isEditing={true} />);

    renderTitleAction(panel);
    fireEvent.click(screen.getByRole('button', { name: 'Edit panel title' }));
    const title = screen.getByRole('textbox', { name: 'Panel title' });
    await user.clear(title);
    await user.type(title, 'Errors{Escape}');

    expect(panel.state.title).toBe('Latency');
    expect(screen.queryByRole('textbox', { name: 'Panel title' })).not.toBeInTheDocument();
  });

  it('does not commit a cancelled title when the input blurs', async () => {
    const { cell, panel } = buildPanelCell();
    render(<NotebookPanelActions cell={cell} panel={panel} isEditing={true} />);

    await screen.findByRole('link', { name: 'Open in Explore' });
    renderTitleAction(panel);
    fireEvent.click(screen.getByRole('button', { name: 'Edit panel title' }));
    const title = screen.getByRole('textbox', { name: 'Panel title' });
    fireEvent.change(title, { target: { value: 'Wrong title' } });
    act(() => {
      fireEvent.keyDown(title, { key: 'Escape' });
      fireEvent.blur(title);
    });

    expect(panel.state.title).toBe('Latency');
  });

  it('shows Add title in the panel header for an untitled panel', async () => {
    const { cell, panel } = buildPanelCell('');
    const { user } = render(<NotebookPanelActions cell={cell} panel={panel} isEditing={true} />);

    expect(panel.state.hoverHeader).toBe(false);
    await screen.findByRole('link', { name: 'Open in Explore' });
    const titleAction = renderTitleAction(panel);
    expect(
      screen.getByRole('button', { name: 'Change visualization' }).closest('[data-notebook-panel-actions]')
    ).not.toContainElement(screen.getByRole('button', { name: 'Add title' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add title' }));
    titleAction.unmount();
    expect(panel.state.hoverHeader).toBe(false);
    await user.type(screen.getByRole('textbox', { name: 'Panel title' }), 'Error rate{Enter}');

    expect(panel.state.title).toBe('Error rate');
    expect(panel.state.hoverHeader).toBe(false);
    expect(screen.queryByRole('button', { name: 'Add title' })).not.toBeInTheDocument();
    renderTitleAction(panel);
    expect(screen.getByRole('button', { name: 'Edit panel title' })).toBeInTheDocument();
  });

  it('treats Add title as a normal panel title when saved', async () => {
    const { cell, panel } = buildPanelCell('Add title');
    render(<NotebookPanelActions cell={cell} panel={panel} isEditing={true} />);

    await screen.findByRole('link', { name: 'Open in Explore' });
    renderTitleAction(panel);
    expect(panel.state.title).toBe('Add title');
    expect(screen.queryByRole('button', { name: 'Add title' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit panel title' })).toBeInTheDocument();
  });

  it('restores the untitled panel hover header in view mode', async () => {
    const { cell, panel } = buildPanelCell('');
    const { rerender } = render(<NotebookPanelActions cell={cell} panel={panel} isEditing={true} />);

    await screen.findByRole('link', { name: 'Open in Explore' });
    expect(panel.state.hoverHeader).toBe(false);
    expect(panel.state.titleItems).toHaveLength(1);
    rerender(<NotebookPanelActions cell={cell} panel={panel} isEditing={false} />);

    expect(panel.state.hoverHeader).toBe(true);
    expect(panel.state.titleItems).toEqual([]);
  });

  it('removes the title action in view mode without changing existing title items', async () => {
    const { cell, panel } = buildPanelCell();
    const existingItem = new SceneReactObject({ reactNode: <span>Existing title item</span> });
    panel.setState({ titleItems: [existingItem] });
    const { rerender } = render(<NotebookPanelActions cell={cell} panel={panel} isEditing={true} />);

    await screen.findByRole('link', { name: 'Open in Explore' });
    expect(panel.state.titleItems).toHaveLength(2);
    rerender(<NotebookPanelActions cell={cell} panel={panel} isEditing={false} />);

    expect(panel.state.titleItems).toEqual([existingItem]);
  });
});
