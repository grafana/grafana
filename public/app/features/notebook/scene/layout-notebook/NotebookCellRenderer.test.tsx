import { seedDataSources } from 'test/helpers/seedDataSources';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';
import { act, fireEvent, render, screen, waitFor, within } from 'test/test-utils';

import { type DataSourceInstanceSettings, EventBusSrv, PluginType } from '@grafana/data';
import { getMockPlugin, getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { getPluginImportUtils, setAppEvents, setPluginImportUtils, setRunRequest } from '@grafana/runtime';
import {
  SceneDataTransformer,
  SceneQueryRunner,
  SceneRefreshPicker,
  SceneReactObject,
  SceneTimePicker,
  SceneTimeRange,
  VizPanel,
} from '@grafana/scenes';
import { LibraryPanelBehavior } from 'app/features/dashboard-scene/scene/LibraryPanelBehavior';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/getQueryRunnerFor';
import * as libraryPanelsApi from 'app/features/library-panels/state/api';
import { runRequest } from 'app/features/query/state/runRequest';

import { NotebookScene } from '../NotebookScene';

import { NotebookCellItem } from './NotebookCellItem';
import { isEditableQueryPanel, NotebookCellRenderer } from './NotebookCellRenderer';
import { NotebookLayoutManager } from './NotebookLayoutManager';
import { NOTEBOOK_CELL_CONTROLS_PINNED_CLASS } from './edit/cellClassNames';

setAppEvents(new EventBusSrv());
setRunRequest(runRequest);
setPluginImportUtils({
  importPanelPlugin: (pluginId) => Promise.resolve(getPanelPlugin({ id: pluginId }, () => <div>Visualization</div>)),
  getPanelPluginFromCache: () => undefined,
});

jest.spyOn(libraryPanelsApi, 'getLibraryPanel').mockResolvedValue({
  uid: 'lp-1',
  name: 'Shared panel',
  model: { type: 'timeseries' },
} as never);

// See CodeCell.test.tsx — the real editor does not run in jsdom.
jest.mock('@grafana/ui/unstable', () => ({
  ...jest.requireActual('@grafana/ui/unstable'),
  CodeMirrorEditor: ({
    value,
    readOnly,
    onChange,
    'aria-label': ariaLabel,
  }: {
    value: string;
    readOnly?: boolean;
    onChange: (value: string) => void;
    'aria-label'?: string;
  }) => (
    <textarea aria-label={ariaLabel} value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} />
  ),
}));

function buildCodeCell() {
  return new NotebookCellItem({
    elementName: 'code-1',
    source: 'user',
    content: { kind: 'Code', spec: { code: 'select 1', language: 'sql' } },
  });
}

function buildMarkdownCell(text = '') {
  return new NotebookCellItem({
    elementName: 'md-1',
    source: 'user',
    content: { kind: 'Markdown', spec: { text } },
  });
}

/** A cell reaches its layout manager through the scene graph, so it has to actually be in one. */
function buildCellInLayout() {
  const cell = buildCodeCell();
  new NotebookLayoutManager({ cells: [cell] });

  return cell;
}

function buildMarkdownCellInLayout(text?: string) {
  const cell = buildMarkdownCell(text);
  new NotebookLayoutManager({ cells: [cell] });

  return cell;
}

describe('NotebookCellRenderer', () => {
  it('restores the visualization when a plugin fails after changing panel state', async () => {
    const importPlugin = jest
      .spyOn(getPluginImportUtils(), 'importPanelPlugin')
      .mockImplementation(async (pluginId) => {
        const plugin = getPanelPlugin({ id: pluginId }, () => <div>Visualization</div>);
        if (pluginId === 'table') {
          plugin.setPanelChangeHandler(() => {
            throw new Error('Cannot migrate visualization');
          });
        }
        return plugin;
      });
    try {
      const panel = new VizPanel({
        key: 'panel-1',
        title: 'Latency',
        pluginId: 'timeseries',
        $data: new SceneQueryRunner({ queries: [{ refId: 'A' }] }),
      });
      const cell = new NotebookCellItem({ elementName: 'latency', source: 'user', body: panel });
      const layout = new NotebookLayoutManager({
        cells: [cell],
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      });
      await panel.changePluginType('timeseries', { legend: { showLegend: true } });
      const originalOptions = structuredClone(panel.state.options);
      const originalFieldConfig = structuredClone(panel.state.fieldConfig);

      await expect(
        layout.changePanelVisualization(cell, {
          name: 'Table',
          pluginId: 'table',
          hash: 'table',
          options: { showHeader: false },
        })
      ).rejects.toThrow('Cannot migrate visualization');

      expect(panel.state.pluginId).toBe('timeseries');
      expect(panel.state.options).toEqual(originalOptions);
      expect(panel.state.fieldConfig).toEqual(originalFieldConfig);
      expect(panel.getPlugin()?.meta.id).toBe('timeseries');
      expect(panel.state.title).toBe('Latency');
      expect(getQueryRunnerFor(panel)?.state.queries).toEqual([{ refId: 'A' }]);
    } finally {
      importPlugin.mockRestore();
    }
  });
  // The edit goes out through the cell to its layout manager, which applies it — cells sharing an
  // element have to move together, and only the manager can see the siblings.
  it('routes an edit through the layout manager onto the cell', async () => {
    const cell = buildCellInLayout();
    const { user } = render(<NotebookCellRenderer cell={cell} isEditing={true} />);

    await user.type(await screen.findByLabelText('Code'), '0');

    expect(cell.state.content).toEqual({ kind: 'Code', spec: { code: 'select 10', language: 'sql' } });
  });

  it('leaves the cell alone while the notebook is being read', async () => {
    const cell = buildCellInLayout();
    render(<NotebookCellRenderer cell={cell} isEditing={false} />);

    expect(await screen.findByLabelText('Code')).toHaveAttribute('readonly');
    expect(cell.state.content).toEqual({ kind: 'Code', spec: { code: 'select 1', language: 'sql' } });
  });

  // A cell outside a layout is a wiring mistake. Failing loudly beats an editor that silently drops
  // what the reader types.
  it('refuses an edit from a cell that is not inside a layout', () => {
    const orphan = buildCodeCell();

    expect(() => orphan.onContentChange({ kind: 'Code', spec: { code: 'x', language: 'sql' } })).toThrow(
      /not inside a NotebookLayoutManager/
    );
  });

  describe('the "/" block-type menu', () => {
    it('opens on a lone "/" and offers every block type', async () => {
      const cell = buildMarkdownCellInLayout();
      const { user } = render(<NotebookCellRenderer cell={cell} isEditing={true} />);

      await user.type(await screen.findByLabelText('Markdown'), '/');

      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Heading' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Paragraph' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Code' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Visualization' })).toBeInTheDocument();
    });

    it('never opens for ordinary typing', async () => {
      const cell = buildMarkdownCellInLayout();
      const { user } = render(<NotebookCellRenderer cell={cell} isEditing={true} />);

      await user.type(await screen.findByLabelText('Markdown'), 'Hello');

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    // The exact bug fixed earlier this session: the menu opening but never closing again once the "/"
    // it was keyed off was gone.
    it('closes once the "/" is backspaced away', async () => {
      const cell = buildMarkdownCellInLayout();
      const { user } = render(<NotebookCellRenderer cell={cell} isEditing={true} />);

      const editor = await screen.findByLabelText('Markdown');
      await user.type(editor, '/');
      expect(screen.getByRole('menu')).toBeInTheDocument();

      await user.type(editor, '{Backspace}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    // useDismiss's default outside-press handling has to replicate what the hand-rolled listener it
    // replaced used to do — dismiss on a press outside both the cell and the menu itself.
    it('closes on an outside click', async () => {
      const cell = buildMarkdownCellInLayout();
      const { user } = render(
        <div>
          <NotebookCellRenderer cell={cell} isEditing={true} />
          <button>Outside</button>
        </div>
      );

      await user.type(await screen.findByLabelText('Markdown'), '/');
      expect(screen.getByRole('menu')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Outside' }));
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('closes on Escape', async () => {
      const cell = buildMarkdownCellInLayout();
      const { user } = render(<NotebookCellRenderer cell={cell} isEditing={true} />);

      await user.type(await screen.findByLabelText('Markdown'), '/');
      expect(screen.getByRole('menu')).toBeInTheDocument();

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    // useDismiss excludes presses on the reference element by default — the cell's own container,
    // wired as the reference — so continuing to interact with the editor itself must not be mistaken
    // for an outside press.
    it('stays open for a press back inside the cell that opened it', async () => {
      const cell = buildMarkdownCellInLayout();
      const { user } = render(<NotebookCellRenderer cell={cell} isEditing={true} />);

      const editor = await screen.findByLabelText('Markdown');
      await user.type(editor, '/');
      expect(screen.getByRole('menu')).toBeInTheDocument();

      await user.click(editor);
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('converts the cell and closes the menu when a type is picked', async () => {
      const cell = buildMarkdownCellInLayout();
      const { user } = render(<NotebookCellRenderer cell={cell} isEditing={true} />);

      await user.type(await screen.findByLabelText('Markdown'), '/');
      await user.click(screen.getByRole('menuitem', { name: 'Paragraph' }));

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(cell.state.content).toEqual({ kind: 'Markdown', spec: { text: '' } });
    });

    // Picking a type that keeps content.kind the same (Paragraph, Heading) converts this cell in
    // place rather than mounting a different one — the caret has nowhere else to go but back here.
    it('asks for focus back after picking a type that keeps this cell mounted', async () => {
      const cell = buildMarkdownCellInLayout();
      const onFocusRequest = jest.fn();
      const { user } = render(<NotebookCellRenderer cell={cell} isEditing={true} onFocusRequest={onFocusRequest} />);

      await user.type(await screen.findByLabelText('Markdown'), '/');
      await user.click(screen.getByRole('menuitem', { name: 'Heading' }));

      expect(onFocusRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('panel controls', () => {
    beforeEach(() => {
      const settings: DataSourceInstanceSettings = {
        uid: 'mock',
        name: 'Mock',
        type: 'mock',
        meta: { ...getMockPlugin({ id: 'mock', type: PluginType.datasource }), metrics: true },
        jsonData: {},
        access: 'proxy',
        readOnly: false,
        isDefault: true,
      };
      seedDataSources([{ settings, api: new MockDataSourceApi(settings) }], { legacySrv: 'mock' });
    });

    function buildPanelCellInLayout(panel: VizPanel) {
      const cell = new NotebookCellItem({ elementName: 'panel-1', source: 'user', body: panel });
      new NotebookScene({
        title: 'Test notebook',
        body: new NotebookLayoutManager({ cells: [cell] }),
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
        timePicker: new SceneTimePicker({}),
        refreshPicker: new SceneRefreshPicker({}),
      });
      return cell;
    }

    it('does not render empty native hover chrome for an untitled notebook panel', async () => {
      const panel = new VizPanel({
        key: 'panel-1',
        title: '',
        hoverHeader: true,
        pluginId: 'stat',
        $data: new SceneQueryRunner({ queries: [] }),
      });
      const cell = buildPanelCellInLayout(panel);
      const layout = cell.getParentLayout();
      const { rerender } = render(<NotebookCellRenderer cell={cell} isEditing={false} />);

      expect(screen.getByTestId(selectors.pages.Notebooks.Item.panelCell('panel-1'))).toBeVisible();
      await waitFor(() => expect(panel.getPlugin()?.meta.id).toBe('stat'));
      expect(screen.queryByTestId(selectors.components.Panels.Panel.HoverWidget.container)).not.toBeInTheDocument();

      act(() => layout.editModeChanged(true));
      rerender(<NotebookCellRenderer cell={cell} isEditing={true} />);
      expect(await screen.findByRole('button', { name: 'Add title' })).toBeVisible();
      act(() => layout.editModeChanged(false));
      rerender(<NotebookCellRenderer cell={cell} isEditing={false} />);
      expect(screen.queryByTestId(selectors.components.Panels.Panel.HoverWidget.container)).not.toBeInTheDocument();
    });

    it('preserves genuine title metadata when edit mode changes', async () => {
      const panel = new VizPanel({
        key: 'panel-1',
        title: '',
        hoverHeader: true,
        pluginId: 'stat',
        titleItems: [new SceneReactObject({ reactNode: <span>Panel context</span> })],
        $data: new SceneQueryRunner({ queries: [] }),
      });
      const cell = buildPanelCellInLayout(panel);
      render(<NotebookCellRenderer cell={cell} isEditing={false} />);

      expect(await screen.findByText('Panel context')).toBeInTheDocument();
      act(() => cell.getParentLayout().editModeChanged(true));
      expect(await screen.findByRole('button', { name: 'Add title' })).toBeVisible();
      act(() => cell.getParentLayout().editModeChanged(false));
      expect(screen.getByText('Panel context')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add title' })).not.toBeInTheDocument();
    });

    it('keeps Stat and Gauge panels compact and restores chart height when the visualization changes', async () => {
      const panel = new VizPanel({
        key: 'panel-1',
        pluginId: 'stat',
        $data: new SceneQueryRunner({ queries: [] }),
      });
      const cell = buildPanelCellInLayout(panel);
      render(<NotebookCellRenderer cell={cell} isEditing={true} />);
      await screen.findByRole('heading', { name: 'Title' });
      const container = screen.getByTestId(selectors.pages.Notebooks.Item.panelCell('panel-1'));

      expect(container).toHaveStyle({ height: '180px' });
      await act(async () => panel.setState({ pluginId: 'timeseries' }));
      expect(container).toHaveStyle({ height: '300px' });
      await act(async () => panel.setState({ pluginId: 'gauge' }));
      expect(container).toHaveStyle({ height: '180px' });
    });

    it('keeps separate controls when a live visualization is duplicated', async () => {
      const panel = new VizPanel({
        key: 'panel-1',
        title: 'Latency',
        pluginId: 'timeseries',
        $data: new SceneQueryRunner({ queries: [] }),
      });
      const cell = buildPanelCellInLayout(panel);
      const layout = cell.getParentLayout();
      const Cells = () => {
        const { cells } = layout.useState();
        return (
          <>
            {cells.map((item) => (
              <div role="group" aria-label={item.state.elementName} key={item.state.elementName}>
                <NotebookCellRenderer
                  cell={item}
                  isEditing={true}
                  onDuplicate={() => layout.duplicateCell(item)}
                  onDelete={() => {}}
                />
              </div>
            ))}
          </>
        );
      };
      const { user } = render(<Cells />);
      act(() => layout.editModeChanged(true));
      await screen.findByRole('heading', { name: 'Latency' });

      act(() => layout.duplicateCell(cell));
      await waitFor(() => expect(screen.getAllByRole('heading', { name: 'Latency' })).toHaveLength(2));
      const original = within(screen.getByRole('group', { name: 'panel-1' }));
      const copy = within(screen.getByRole('group', { name: 'panel-1-copy-1' }));
      expect(original.getAllByRole('button', { name: 'Block actions' })).toHaveLength(1);
      expect(copy.getAllByRole('button', { name: 'Block actions' })).toHaveLength(1);
      expect(copy.getAllByRole('button', { name: 'Edit panel title' })).toHaveLength(1);

      fireEvent.click(copy.getByRole('button', { name: 'Edit panel title' }));
      const title = copy.getByRole('textbox', { name: 'Panel title' });
      await user.clear(title);
      await user.type(title, 'Copied latency{Enter}');
      expect(panel.state.title).toBe('Latency');
      expect(layout.state.cells[1].state.body?.state.title).toBe('Copied latency');
    });

    it('starts existing query editors closed and opens them below the visualization', async () => {
      const cell = buildPanelCellInLayout(
        new VizPanel({
          key: 'panel-1',
          title: 'Latency',
          pluginId: 'timeseries',
          $data: new SceneQueryRunner({ queries: [{ refId: 'A' }] }),
        })
      );
      const { user } = render(<NotebookCellRenderer cell={cell} isEditing={true} />);

      const toggle = await screen.findByRole('button', { name: 'Edit query' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('button', { name: 'Run query' })).not.toBeInTheDocument();

      act(() => toggle.focus());
      await user.keyboard('{Enter}');
      const run = await screen.findByRole('button', { name: 'Run query' });
      expect(run).toBeVisible();
      expect(
        screen.getByText('Visualization').compareDocumentPosition(run) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Hide query editor' })).toHaveAttribute('aria-expanded', 'true');
    });

    it('starts the query editor open for a newly inserted visualization', async () => {
      const cell = buildPanelCellInLayout(
        new VizPanel({
          key: 'panel-1',
          pluginId: 'timeseries',
          $data: new SceneQueryRunner({ queries: [{ refId: 'A' }] }),
        })
      );
      render(<NotebookCellRenderer cell={cell} isEditing={true} autoFocus={true} />);

      expect(await screen.findByRole('button', { name: 'Run query' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Hide query editor' })).toHaveAttribute('aria-expanded', 'true');
    });

    it('keeps the query form mounted when it is hidden and reopened', async () => {
      const cell = buildPanelCellInLayout(
        new VizPanel({
          key: 'panel-1',
          pluginId: 'timeseries',
          $data: new SceneQueryRunner({ queries: [{ refId: 'A' }] }),
        })
      );
      const { user } = render(<NotebookCellRenderer cell={cell} isEditing={true} autoFocus={true} />);
      const run = await screen.findByRole('button', { name: 'Run query' });

      const toggle = screen.getByRole('button', { name: 'Hide query editor' });
      act(() => toggle.focus());
      await user.keyboard('{Enter}');
      expect(run).toBeInTheDocument();
      expect(run).not.toBeVisible();
      await user.keyboard('{Enter}');
      expect(screen.getByRole('button', { name: 'Run query' })).toBe(run);
      expect(run).toBeVisible();
    });

    it('keeps the time-range control available when the query editor is hidden', async () => {
      const panel = new VizPanel({
        key: 'panel-1',
        pluginId: 'timeseries',
        $data: new SceneQueryRunner({ queries: [] }),
      });
      const cell = buildPanelCellInLayout(panel);
      render(<NotebookCellRenderer cell={cell} isEditing={true} autoFocus={true} />);

      expect(await screen.findByRole('button', { name: 'Update time range' })).toBeInTheDocument();
      act(() => cell.onTimeRangeChange({ from: 'now-24h', to: 'now' }));
      expect(await screen.findByRole('button', { name: 'Locked: Last 24 hours' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Update time range' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Hide query editor' }));

      fireEvent.click(screen.getByRole('button', { name: 'Locked: Last 24 hours' }));
      expect(await screen.findByRole('textbox', { name: 'From' })).toHaveValue('now-24h');
    });

    it('replaces the clock with a locked range above the panel and restores it on removal', async () => {
      const panel = new VizPanel({
        key: 'panel-1',
        title: 'Latency',
        pluginId: 'timeseries',
        $data: new SceneQueryRunner({ queries: [] }),
      });
      const cell = buildPanelCellInLayout(panel);
      const { user } = render(<NotebookCellRenderer cell={cell} isEditing={true} />);
      const clock = await screen.findByRole('button', { name: 'Update time range' });
      act(() => clock.focus());
      await user.keyboard('{Enter}');
      const toolbar = clock.closest('[data-notebook-panel-actions]');
      expect(toolbar).toHaveClass(NOTEBOOK_CELL_CONTROLS_PINNED_CLASS);
      await user.click(screen.getByRole('checkbox', { name: 'Last 24 hours' }));
      expect(toolbar).not.toHaveClass(NOTEBOOK_CELL_CONTROLS_PINNED_CLASS);

      const badge = await screen.findByRole('button', { name: 'Locked: Last 24 hours' });
      const title = screen.getByRole('heading', { name: 'Latency' });
      expect(badge.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Update time range' })).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      await user.click(badge);
      const picker = await screen.findByRole('dialog', { name: 'Panel time range' });
      expect(within(picker).getByRole('textbox', { name: 'From' })).toHaveValue('now-24h');
      await user.click(within(picker).getByRole('button', { name: 'Remove time lock' }));
      const restoredClock = await screen.findByRole('button', { name: 'Update time range' });
      await waitFor(() => expect(restoredClock).toHaveFocus());
      expect(screen.queryByRole('button', { name: 'Locked: Last 24 hours' })).not.toBeInTheDocument();
      expect(panel.state.subHeader).toBeUndefined();
      expect(cell.state.$timeRange).toBeUndefined();
    });

    it('mounts for a library panel while editing, even though it has no query editor', async () => {
      const panel = new VizPanel({
        key: 'panel-1',
        pluginId: 'timeseries',
        $data: new SceneQueryRunner({ queries: [] }),
        $behaviors: [new LibraryPanelBehavior({ uid: 'lp-1', name: 'Shared panel' })],
      });
      const cell = buildPanelCellInLayout(panel);

      render(<NotebookCellRenderer cell={cell} isEditing={true} />);

      expect(await screen.findByRole('button', { name: /time range/i })).toBeInTheDocument();
    });

    it('mounts for a panel with transformations while editing, even though it has no query editor', async () => {
      const panel = new VizPanel({
        key: 'panel-1',
        pluginId: 'timeseries',
        $data: new SceneDataTransformer({
          $data: new SceneQueryRunner({ queries: [] }),
          transformations: [{ id: 'limit', options: {} }],
        }),
      });
      const cell = buildPanelCellInLayout(panel);

      render(<NotebookCellRenderer cell={cell} isEditing={true} />);

      expect(await screen.findByRole('button', { name: /time range/i })).toBeInTheDocument();
    });

    it('hides the trigger in view mode when there is no override to report', async () => {
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries' });
      const cell = buildPanelCellInLayout(panel);

      render(<NotebookCellRenderer cell={cell} isEditing={false} />);

      // Lets the panel's own async plugin load settle before asserting, same as the tests above.
      await screen.findByTestId('loading-plugin-panel-1');
      expect(screen.queryByRole('button', { name: /time range/i })).not.toBeInTheDocument();
    });

    it('shows a read-only locked range in view mode without edit or remove actions', async () => {
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries', hoverHeader: true });
      const cell = new NotebookCellItem({
        elementName: 'panel-1',
        source: 'user',
        body: panel,
        $timeRange: new SceneTimeRange({ from: 'now-24h', to: 'now' }),
      });
      new NotebookScene({
        title: 'Test notebook',
        body: new NotebookLayoutManager({ cells: [cell] }),
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
        timePicker: new SceneTimePicker({}),
        refreshPicker: new SceneRefreshPicker({}),
      });

      render(<NotebookCellRenderer cell={cell} isEditing={false} />);

      await waitFor(() => expect(screen.getByText('Locked: Last 24 hours')).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: /locked|time range|remove time lock/i })).not.toBeInTheDocument();
    });

    it('resolves a cell time range set while mounted, instead of leaving it at its placeholder default', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));

      const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries' });
      const cell = buildPanelCellInLayout(panel);

      render(<NotebookCellRenderer cell={cell} isEditing={false} />);
      await screen.findByTestId('loading-plugin-panel-1');

      act(() => cell.getParentLayout().setCellTimeRange(cell, { from: 'now-1h', to: 'now' }));

      expect(cell.state.$timeRange?.state.value.from.toISOString()).toBe('2024-01-01T11:00:00.000Z');

      jest.useRealTimers();
    });
  });

  describe('isEditableQueryPanel', () => {
    it('allows a plain panel with a query runner and no transformations', () => {
      const panel = new VizPanel({
        key: 'panel-1',
        pluginId: 'timeseries',
        $data: new SceneQueryRunner({ queries: [] }),
      });

      expect(isEditableQueryPanel(panel)).toBe(true);
    });

    it('excludes a panel with no query runner at all', () => {
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries' });

      expect(isEditableQueryPanel(panel)).toBe(false);
    });

    it('excludes a panel with transformations', () => {
      const panel = new VizPanel({
        key: 'panel-1',
        pluginId: 'timeseries',
        $data: new SceneDataTransformer({
          $data: new SceneQueryRunner({ queries: [] }),
          transformations: [{ id: 'limit', options: {} }],
        }),
      });

      expect(isEditableQueryPanel(panel)).toBe(false);
    });

    // vizPanelToSchemaV2 serializes any panel carrying LibraryPanelBehavior only as a reference to the
    // shared library panel — never as a full PanelKind with its own queries — so query edits made
    // through this editor on a library panel would look like they saved and then be silently
    // discarded on the next save/reload.
    it('excludes a library panel, even with a query runner and no transformations', () => {
      const panel = new VizPanel({
        key: 'panel-1',
        pluginId: 'timeseries',
        $data: new SceneQueryRunner({ queries: [] }),
        $behaviors: [new LibraryPanelBehavior({ uid: 'lp-1', name: 'Shared panel' })],
      });

      expect(isEditableQueryPanel(panel)).toBe(false);
    });
  });
});
