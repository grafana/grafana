import { type ComponentProps } from 'react';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';
import { act, fireEvent, render, screen, waitFor } from 'test/test-utils';

import { CoreApp, getDefaultTimeRange, LoadingState, toDataFrame } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime';
import { SceneQueryRunner, SceneReactObject, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { tryGetExploreUrlForPanel } from 'app/features/dashboard-scene/utils/urlBuilders';
import { getAllSuggestions } from 'app/features/panel/suggestions/getAllSuggestions';

import { NotebookCellItem } from './NotebookCellItem';
import { NotebookLayoutManager } from './NotebookLayoutManager';
import { NotebookPanelActions } from './NotebookPanelActions';
import { PanelTitleEditor } from './PanelTitleEditor';
import { NOTEBOOK_CELL_CONTROLS_PINNED_CLASS } from './edit/cellClassNames';

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
jest.mock('app/features/panel/components/PanelRenderer', () => ({
  PanelRenderer: () => <div>Visualization preview</div>,
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

function NotebookPanelControls(props: ComponentProps<typeof NotebookPanelActions>) {
  return (
    <>
      <NotebookPanelActions {...props} />
      <PanelTitleEditor cell={props.cell} panel={props.panel} isEditing={props.isEditing} />
    </>
  );
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
    render(<NotebookPanelControls cell={cell} panel={panel} isEditing={false} />);

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

    render(<NotebookPanelControls cell={cell} panel={panel} isEditing={false} />);

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

    render(<NotebookPanelControls cell={cell} panel={panel} isEditing={false} />);

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

    render(<NotebookPanelControls cell={cell} panel={panel} isEditing={false} />);

    await screen.findByRole('link', { name: 'Open in Explore' });
    expect(tryGetExploreUrlForPanel).toHaveBeenCalledWith(panel, runner.state.queries);
  });

  it('groups visualization controls with a shared block menu in edit mode', async () => {
    const { cell, panel } = buildPanelCell();
    const onDuplicate = jest.fn();
    const onDelete = jest.fn();
    const { user } = render(
      <NotebookPanelControls cell={cell} panel={panel} isEditing={true} onDuplicate={onDuplicate} onDelete={onDelete} />
    );

    await screen.findByRole('link', { name: 'Open in Explore' });
    const toolbar = screen
      .getByRole('button', { name: 'Change visualization' })
      .closest('[data-notebook-panel-actions]');
    expect(toolbar).not.toContainElement(screen.getByRole('button', { name: 'Edit panel title' }));
    expect(toolbar).toContainElement(screen.getByRole('button', { name: 'Change visualization' }));
    expect(toolbar).toContainElement(screen.getByRole('link', { name: 'Open in Explore' }));
    expect(toolbar).toContainElement(screen.getByRole('button', { name: 'Block actions' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    act(() => screen.getByRole('button', { name: 'Block actions' }).focus());
    await user.keyboard('{Enter}');
    expect(toolbar).toHaveClass(NOTEBOOK_CELL_CONTROLS_PINNED_CLASS);
    await user.click(await screen.findByRole('menuitem', { name: 'Duplicate block' }));
    expect(toolbar).not.toHaveClass(NOTEBOOK_CELL_CONTROLS_PINNED_CLASS);
    act(() => screen.getByRole('button', { name: 'Block actions' }).focus());
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('menuitem', { name: 'Delete block' }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it.each(['react', 'scene', 'array'] as const)(
    'does not mutate %s header actions or title controls while rendering',
    async (representation) => {
      const { cell, panel } = buildPanelCell();
      const headerNode = <span>Existing header action</span>;
      const headerObject = new SceneReactObject({ reactNode: headerNode });
      const existingHeader =
        representation === 'react' ? headerNode : representation === 'scene' ? headerObject : [headerObject];
      const existingTitle = new SceneReactObject({ reactNode: <span>Existing title control</span> });
      const titleItems = [existingTitle];
      panel.setState({ headerActions: existingHeader, titleItems });
      const setState = jest.spyOn(panel, 'setState');
      const { rerender, unmount } = render(<NotebookPanelControls cell={cell} panel={panel} isEditing={true} />);
      await screen.findByRole('link', { name: 'Open in Explore' });

      rerender(<NotebookPanelControls cell={cell} panel={panel} isEditing={false} />);
      unmount();

      expect(setState).not.toHaveBeenCalled();
      expect(panel.state.headerActions).toBe(existingHeader);
      expect(panel.state.titleItems).toBe(titleItems);
    }
  );

  it('toggles the query editor when available', async () => {
    const { cell, panel } = buildPanelCell();
    const onToggleQueryEditor = jest.fn();
    const { user } = render(
      <NotebookPanelControls
        cell={cell}
        panel={panel}
        isEditing={true}
        onToggleQueryEditor={onToggleQueryEditor}
        queryEditorOpen={false}
      />
    );

    await screen.findByRole('link', { name: 'Open in Explore' });
    expect(screen.getByRole('button', { name: 'Edit query' })).toHaveAttribute('aria-pressed', 'false');
    act(() => screen.getByRole('button', { name: 'Edit query' }).focus());
    await user.keyboard('{Enter}');
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
    cell.initializeAutoSuggest(true);
    const { user } = render(<NotebookPanelControls cell={cell} panel={panel} isEditing={true} />);

    act(() => screen.getByRole('button', { name: 'Change visualization' }).focus());
    await user.keyboard('{Enter}');
    const suggestion = await screen.findByRole('button', { name: 'Table' });
    expect(suggestion).toBeVisible();
    const toolbar = screen
      .getByRole('button', { name: 'Change visualization' })
      .closest('[data-notebook-panel-actions]');
    expect(toolbar).toHaveClass(NOTEBOOK_CELL_CONTROLS_PINNED_CLASS);
    await user.click(suggestion);

    await waitFor(() => expect(cell.onVisualizationChange).toHaveBeenCalled());
    expect(cell.shouldAutoSuggest({ refId: 'B' })).toBe(false);
    expect(toolbar).not.toHaveClass(NOTEBOOK_CELL_CONTROLS_PINNED_CLASS);
    expect(cell.onVisualizationChange).toHaveBeenCalledWith(expect.objectContaining({ pluginId: 'table' }));
    expect(screen.queryByRole('button', { name: 'Table' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change visualization' })).toHaveAttribute('aria-expanded', 'false');

    act(() => screen.getByRole('button', { name: 'Change visualization' }).focus());
    await user.keyboard('{Enter}');
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
    cell.initializeAutoSuggest(true);
    const { user } = render(<NotebookPanelControls cell={cell} panel={panel} isEditing={true} />);

    act(() => screen.getByRole('button', { name: 'Change visualization' }).focus());
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('button', { name: 'Table' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not change visualization. Try again.');
    expect(panel.state.pluginId).toBe('timeseries');
    expect(cell.shouldAutoSuggest({ refId: 'A' })).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Table' }));

    await waitFor(() => expect(changeVisualization).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Change visualization' })).toHaveAttribute('aria-expanded', 'false')
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each(['success', 'failure'])('keeps suggestion focus through a data refresh %s', async (outcome) => {
    const { cell, panel } = buildPanelCell();
    const runner = panel.state.$data as SceneQueryRunner;
    const data = {
      state: LoadingState.Done,
      series: [toDataFrame({ fields: [{ name: 'value', values: [1] }] })],
      timeRange: getDefaultTimeRange(),
    };
    runner.setState({ data });
    const result = {
      suggestions: [{ name: 'Table', pluginId: 'table', hash: 'table', options: {} }],
      hasErrors: false,
    };
    let finishRefresh!: (nextResult: typeof result) => void;
    let rejectRefresh!: (error: Error) => void;
    jest
      .mocked(getAllSuggestions)
      .mockResolvedValueOnce(result)
      .mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            finishRefresh = resolve;
            rejectRefresh = reject;
          })
      );
    const { user } = render(<NotebookPanelControls cell={cell} panel={panel} isEditing={true} />);
    act(() => screen.getByRole('button', { name: 'Change visualization' }).focus());
    await user.keyboard('{Enter}');
    const suggestion = await screen.findByRole('button', { name: 'Table' });
    await waitFor(() => expect(screen.getByTestId('toggletip-content').contains(document.activeElement)).toBe(true));
    act(() => suggestion.focus());

    act(() =>
      runner.setState({
        data: { ...data, series: [toDataFrame({ fields: [{ name: 'value', values: [2] }] })] },
      })
    );

    expect(screen.getByRole('button', { name: 'Table' })).toBe(suggestion);
    expect(suggestion).toHaveFocus();
    await act(async () => {
      if (outcome === 'success') {
        finishRefresh(result);
      } else {
        rejectRefresh(new Error('Could not refresh suggestions'));
      }
    });
    expect(screen.getByRole('button', { name: 'Table' })).toBe(suggestion);
    expect(suggestion).toHaveFocus();
  });

  it('has one tab stop per visualization suggestion', async () => {
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
      suggestions: [
        { name: 'Table', pluginId: 'table', hash: 'table', options: {} },
        { name: 'Stat', pluginId: 'stat', hash: 'stat', options: {} },
      ],
      hasErrors: false,
    });
    const { user } = render(<NotebookPanelControls cell={cell} panel={panel} isEditing={true} />);

    act(() => screen.getByRole('button', { name: 'Change visualization' }).focus());
    await user.keyboard('{Enter}');
    const table = await screen.findByRole('button', { name: 'Table' });
    const stat = screen.getByRole('button', { name: 'Stat' });
    await waitFor(() => expect(screen.getByTestId('toggletip-content').contains(document.activeElement)).toBe(true));
    act(() => table.focus());

    await user.tab();
    expect(stat).toHaveFocus();
    await user.tab({ shift: true });
    expect(table).toHaveFocus();
  });

  it.each([
    { key: 'Enter', input: '{Enter}' },
    { key: 'Space', input: ' ' },
  ])('selects a visualization with $key and returns focus to the trigger', async ({ input }) => {
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
    const { user } = render(<NotebookPanelControls cell={cell} panel={panel} isEditing={true} />);

    const trigger = screen.getByRole('button', { name: 'Change visualization' });
    act(() => trigger.focus());
    await user.keyboard('{Enter}');
    const suggestion = await screen.findByRole('button', { name: 'Table' });
    await waitFor(() => expect(screen.getByTestId('toggletip-content').contains(document.activeElement)).toBe(true));
    act(() => suggestion.focus());
    await user.keyboard(input);

    await waitFor(() => {
      expect(cell.onVisualizationChange).toHaveBeenCalledTimes(1);
      expect(cell.onVisualizationChange).toHaveBeenCalledWith(expect.objectContaining({ pluginId: 'table' }));
      expect(screen.queryByRole('button', { name: 'Table' })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it('updates the panel title while editing', async () => {
    const { cell, panel } = buildPanelCell();
    const titleItems = panel.state.titleItems;
    const { user } = render(<NotebookPanelControls cell={cell} panel={panel} isEditing={true} />);

    expect(screen.getByRole('button', { name: 'Change visualization' })).toBeInTheDocument();
    act(() => screen.getByRole('button', { name: 'Edit panel title' }).focus());
    await user.keyboard('{Enter}');
    const title = screen.getByRole('textbox', { name: 'Panel title' });
    expect(
      screen.getByRole('button', { name: 'Change visualization' }).closest('[data-notebook-panel-actions]')
    ).not.toContainElement(title);
    await user.clear(title);
    await user.type(title, 'Error rate{Enter}');

    expect(panel.state.title).toBe('Error rate');
    expect(panel.state.titleItems).toBe(titleItems);
    expect(screen.queryByRole('textbox', { name: 'Panel title' })).not.toBeInTheDocument();
  });

  it('restores the previous title when rename is cancelled', async () => {
    const { cell, panel } = buildPanelCell();
    const { user } = render(<NotebookPanelControls cell={cell} panel={panel} isEditing={true} />);

    act(() => screen.getByRole('button', { name: 'Edit panel title' }).focus());
    await user.keyboard('{Enter}');
    const title = screen.getByRole('textbox', { name: 'Panel title' });
    await user.clear(title);
    await user.type(title, 'Errors{Escape}');

    expect(panel.state.title).toBe('Latency');
    expect(screen.queryByRole('textbox', { name: 'Panel title' })).not.toBeInTheDocument();
  });

  it('does not commit a cancelled title when the input blurs', async () => {
    const { cell, panel } = buildPanelCell();
    render(<NotebookPanelControls cell={cell} panel={panel} isEditing={true} />);

    await screen.findByRole('link', { name: 'Open in Explore' });
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
    const { user } = render(<NotebookPanelControls cell={cell} panel={panel} isEditing={true} />);

    await screen.findByRole('link', { name: 'Open in Explore' });
    expect(
      screen.getByRole('button', { name: 'Change visualization' }).closest('[data-notebook-panel-actions]')
    ).not.toContainElement(screen.getByRole('button', { name: 'Add title' }));
    await user.click(screen.getByRole('button', { name: 'Add title' }));
    await user.type(screen.getByRole('textbox', { name: 'Panel title' }), 'Error rate{Enter}');

    expect(panel.state.title).toBe('Error rate');
    expect(screen.queryByRole('button', { name: 'Add title' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit panel title' })).toBeInTheDocument();
  });

  it('treats Add title as a normal panel title when saved', async () => {
    const { cell, panel } = buildPanelCell('Add title');
    render(<NotebookPanelControls cell={cell} panel={panel} isEditing={true} />);

    await screen.findByRole('link', { name: 'Open in Explore' });
    expect(panel.state.title).toBe('Add title');
    expect(screen.queryByRole('button', { name: 'Add title' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit panel title' })).toBeInTheDocument();
  });

  it('hides title editing in view mode without replacing native title items', async () => {
    const { cell, panel } = buildPanelCell();
    const titleItems = panel.state.titleItems;
    const { rerender } = render(<NotebookPanelControls cell={cell} panel={panel} isEditing={true} />);
    await screen.findByRole('link', { name: 'Open in Explore' });

    rerender(<NotebookPanelControls cell={cell} panel={panel} isEditing={false} />);

    expect(screen.queryByRole('button', { name: 'Edit panel title' })).not.toBeInTheDocument();
    expect(panel.state.titleItems).toBe(titleItems);
  });
});
