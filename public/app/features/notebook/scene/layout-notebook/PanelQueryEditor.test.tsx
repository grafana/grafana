import { act } from 'react';
import { render, screen, waitFor } from 'test/test-utils';

import { type DataQuery, type DataSourceInstanceSettings, type DataSourceRef } from '@grafana/data';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { buildVizPanelState } from 'app/features/dashboard-scene/serialization/layoutSerializers/utils';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/utils';
import { defaultVisualizationPanelKind } from 'app/features/notebook/types';

import { NotebookScene } from '../NotebookScene';

import { NotebookCellItem } from './NotebookCellItem';
import { NotebookLayoutManager } from './NotebookLayoutManager';
import { PanelQueryEditor } from './PanelQueryEditor';
import { setQueryRunnerQueries } from './setQueryRunnerQueries';

// QueryEditorRow pulls in real datasource plugin loading (DataSourcePluginContextProvider, the
// plugin's own QueryEditor component) to render anything meaningful — none of which runs in jsdom.
// The stub exposes just enough of its contract for this file's assertions: the resolved datasource,
// the current query, and the callbacks PanelQueryEditorRow wires to it — every button name is suffixed
// with the row's own refId so a multi-row test can target one row without ambiguity.
jest.mock('app/features/query/components/QueryEditorRow', () => ({
  QueryEditorRow: ({
    dataSource,
    query,
    app,
    onChange,
    onChangeDataSource,
    onRunQuery,
    onAddQuery,
    onRemoveQuery,
    onReplace,
    onReplaceQueries,
    isOpen,
    onQueryClosed,
  }: {
    dataSource: DataSourceInstanceSettings;
    query: DataQuery;
    app?: string;
    onChange: (query: DataQuery) => void;
    onChangeDataSource?: (settings: DataSourceInstanceSettings) => void;
    onRunQuery: () => void;
    onAddQuery: (query: DataQuery) => void;
    onRemoveQuery: (query: DataQuery) => void;
    onReplace?: (query: DataQuery) => void;
    onReplaceQueries?: (queries: DataQuery[]) => void;
    isOpen?: boolean;
    onQueryClosed?: () => void;
  }) => (
    <div data-testid={`row-${query.refId}`}>
      <span data-testid={`resolved-datasource-${query.refId}`}>{dataSource.uid}</span>
      <span data-testid={`current-query-${query.refId}`}>{JSON.stringify(query)}</span>
      <span data-testid={`is-open-${query.refId}`}>{String(Boolean(isOpen))}</span>
      <span data-testid={`app-${query.refId}`}>{app}</span>
      <button onClick={() => onChange({ ...query, expr: 'up' } as DataQuery)}>edit query {query.refId}</button>
      {onChangeDataSource && (
        <button
          onClick={() => onChangeDataSource({ uid: 'other-uid', type: 'other-type' } as DataSourceInstanceSettings)}
        >
          switch datasource {query.refId}
        </button>
      )}
      {onChangeDataSource && (
        <button
          onClick={() =>
            onChangeDataSource({ uid: 'other-instance-same-type', type: dataSource.type } as DataSourceInstanceSettings)
          }
        >
          switch to same-type datasource {query.refId}
        </button>
      )}
      <button onClick={onRunQuery}>run from row {query.refId}</button>
      {/* Mirrors QueryOperationRow's own onClose — fired only when the user manually collapses an
          already-open row, never on mount. */}
      <button onClick={onQueryClosed}>collapse query {query.refId}</button>
      {/* Mirrors the real row's onCopyQuery: hands the same query back to onAddQuery, refId
          untouched — proving the wiring (not this stub) is what assigns a fresh one. */}
      <button onClick={() => onAddQuery(query)}>duplicate query {query.refId}</button>
      <button onClick={() => onRemoveQuery(query)}>remove query {query.refId}</button>
      <button onClick={() => onReplace?.({ refId: 'lib', expr: 'from-library' } as DataQuery)}>
        replace query {query.refId}
      </button>
      <button
        onClick={() =>
          onReplaceQueries?.([
            { refId: 'lib-1', expr: 'from-library-1' } as DataQuery,
            { refId: 'lib-2', expr: 'from-library-2' } as DataQuery,
          ])
        }
      >
        replace with two queries {query.refId}
      </button>
    </div>
  ),
}));

jest.mock('app/features/datasources/components/picker/DataSourcePicker', () => ({
  DataSourcePicker: ({ onChange }: { onChange: (settings: DataSourceInstanceSettings) => void }) => (
    <button onClick={() => onChange({ uid: 'picked-uid', type: 'picked-type' } as DataSourceInstanceSettings)}>
      pick a datasource
    </button>
  ),
}));

// The suggestion pipeline (getVizSuggestionForQuery -> runRequest -> getAllSuggestions) runs a real
// request against a real datasource — entirely out of scope for this file, which only cares that
// PanelQueryEditor applies whatever it resolves to before running the query for real.
const getVizSuggestionForQuery = jest.fn();
jest.mock('app/features/dashboard-scene/utils/getVizSuggestionForQuery', () => ({
  getVizSuggestionForQuery: (...args: unknown[]) => getVizSuggestionForQuery(...args),
}));

let resolvedSettings: { uid: string; type: string; name: string } | undefined = {
  uid: 'default-uid',
  type: 'testdata',
  name: 'gdev-testdata',
};

function settingsForRef(ref?: DataSourceRef | string) {
  if (!resolvedSettings) {
    return undefined;
  }
  const uid = typeof ref === 'string' ? ref : ref?.uid;
  return { ...resolvedSettings, uid: uid ?? resolvedSettings.uid };
}

let defaultQueryForNewType: Record<string, unknown> | undefined;
const getDataSourceInstance = jest.fn(async (..._args: unknown[]) => ({
  getDefaultQuery: () => defaultQueryForNewType,
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceSettings: jest.fn(async (ref?: DataSourceRef | string) => settingsForRef(ref)),
  getDataSourceInstance: (...args: unknown[]) => getDataSourceInstance(...args),
  useDataSourceInstanceSettings: (ref?: DataSourceRef | string) => ({
    isLoading: false,
    settings: settingsForRef(ref),
  }),
}));

/**
 * A real Panel VizPanel, its owning NotebookCellItem, and the notebook scene's undo/redo history —
 * built the same way NotebookLayoutManager's buildVisualizationPanel does, parented under a scene
 * that carries a $timeRange, since PanelQueryEditor reads the panel's own SceneQueryRunner and the
 * shared time range straight off the scene graph rather than through props.
 *
 * `queries`, when given, fully replaces the panel's single default query — one partial per row,
 * each assigned its own refId (A, B, C, ...) so multi-row tests can address a specific one.
 */
function buildPanel(queries?: Array<Record<string, unknown>>) {
  const panel = new VizPanel(buildVizPanelState(defaultVisualizationPanelKind(), 1));
  if (queries) {
    const runner = getQueryRunnerFor(panel)!;
    const base = runner.state.queries[0];
    // Routed through the same helper the editor itself uses, so a fixture seeded with queries
    // spanning datasources already reflects the runner-level Mixed sync a real user flow would have
    // produced one step at a time.
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

  return { panel, cell, history: scene.editHistory };
}

beforeEach(() => {
  resolvedSettings = { uid: 'default-uid', type: 'testdata', name: 'gdev-testdata' };
  getVizSuggestionForQuery.mockReset().mockResolvedValue(undefined);
  defaultQueryForNewType = undefined;
  getDataSourceInstance.mockClear();
});

describe('PanelQueryEditor', () => {
  it('resolves the panel’s own query datasource', async () => {
    const { panel, cell } = buildPanel();
    render(<PanelQueryEditor panel={panel} cell={cell} />);

    expect(await screen.findByTestId('resolved-datasource-A')).toHaveTextContent('default-uid');
  });

  it('offers a datasource picker when nothing resolves', async () => {
    resolvedSettings = undefined;
    const { panel, cell } = buildPanel();
    render(<PanelQueryEditor panel={panel} cell={cell} />);

    expect(await screen.findByRole('button', { name: 'pick a datasource' })).toBeInTheDocument();
    expect(screen.queryByTestId('resolved-datasource-A')).not.toBeInTheDocument();
  });

  it('writes a picked datasource straight onto the runner', async () => {
    resolvedSettings = undefined;
    const { panel, cell } = buildPanel();
    const runner = getQueryRunnerFor(panel)!;
    const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

    await user.click(await screen.findByRole('button', { name: 'pick a datasource' }));

    expect(runner.state.queries[0].datasource).toEqual({ uid: 'picked-uid', type: 'picked-type' });
    // The runner-level datasource, not just the query's own field, has to stay in sync — a regular
    // datasource plugin ignores each query's own `datasource` field and just runs everything against
    // whatever the runner itself points at (see setQueryRunnerQueries's own comment).
    expect(runner.state.datasource).toEqual({ uid: 'picked-uid', type: 'picked-type' });
  });

  it('opens the row once a datasource is picked for the first time', async () => {
    resolvedSettings = undefined;
    const { panel, cell } = buildPanel();
    const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);
    const pickButton = await screen.findByRole('button', { name: 'pick a datasource' });
    // Only resolves *after* the picker has had its chance to render — this mock has no per-ref
    // control, only a single global on/off switch.
    resolvedSettings = { uid: 'picked-uid', type: 'picked-type', name: 'picked' };

    await user.click(pickButton);

    expect(await screen.findByTestId('is-open-A')).toHaveTextContent('true');
  });

  it('preserves refId and hide when the query editor reports an edit', async () => {
    const { panel, cell } = buildPanel();
    const runner = getQueryRunnerFor(panel)!;
    const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

    await user.click(await screen.findByRole('button', { name: 'edit query A' }));

    expect(runner.state.queries[0]).toEqual(expect.objectContaining({ refId: 'A', hide: false, expr: 'up' }));
  });

  it('identifies itself to the row as the notebook app', async () => {
    const { panel, cell } = buildPanel();
    render(<PanelQueryEditor panel={panel} cell={cell} />);

    expect(await screen.findByTestId('app-A')).toHaveTextContent('notebook');
  });

  it('switches datasource from the row header without losing the query spec', async () => {
    const { panel, cell } = buildPanel([{ expr: 'up', datasource: { uid: 'default-uid', type: 'testdata' } }]);
    const runner = getQueryRunnerFor(panel)!;
    const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

    await user.click(await screen.findByRole('button', { name: 'switch datasource A' }));

    expect(runner.state.queries[0]).toEqual(
      expect.objectContaining({ expr: 'up', datasource: { uid: 'other-uid', type: 'other-type' } })
    );
  });

  it('reinitializes the query from the new datasource’s defaults when the type changes', async () => {
    defaultQueryForNewType = { legendFormat: 'auto', maxDataPoints: 100 };
    const { panel, cell } = buildPanel([
      { expr: 'up', maxDataPoints: 50, datasource: { uid: 'default-uid', type: 'testdata' } },
    ]);
    const runner = getQueryRunnerFor(panel)!;
    const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

    await user.click(await screen.findByRole('button', { name: 'switch datasource A' }));

    await waitFor(() =>
      expect(runner.state.queries[0]).toEqual(
        expect.objectContaining({
          refId: 'A',
          // Filled in from the new datasource's own defaults, since the row had nothing of its own.
          legendFormat: 'auto',
          // The row's own value wins over the default on a colliding key — not a full conversion.
          maxDataPoints: 50,
          // The old plugin's own field is left as-is; the new editor simply won't read it.
          expr: 'up',
          datasource: { uid: 'other-uid', type: 'other-type' },
        })
      )
    );
  });

  it('keeps the existing query as-is when switching to a different instance of the same type', async () => {
    const { panel, cell } = buildPanel([{ expr: 'up', datasource: { uid: 'default-uid', type: 'testdata' } }]);
    const runner = getQueryRunnerFor(panel)!;
    const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

    await user.click(await screen.findByRole('button', { name: 'switch to same-type datasource A' }));

    await waitFor(() =>
      expect(runner.state.queries[0]).toEqual(
        expect.objectContaining({ expr: 'up', datasource: { uid: 'other-instance-same-type', type: 'testdata' } })
      )
    );
    // No reinitialization needed: the existing query model is still valid for the same plugin type.
    expect(getDataSourceInstance).not.toHaveBeenCalled();
  });

  // The row's header (including its own datasource picker) is always visible, collapsed or not — so
  // switching datasource there needs the same auto-open as picking one for the first time. Without
  // it, a reader who switches datasource on an already-collapsed row is left looking at a chevron,
  // not the now-likely-stale query for the datasource they just switched to.
  it('opens the row when the datasource is switched on an already-configured row', async () => {
    const { panel, cell } = buildPanel([{ expr: 'up', datasource: { uid: 'default-uid', type: 'testdata' } }]);
    const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);
    expect(await screen.findByTestId('is-open-A')).toHaveTextContent('false');

    await user.click(await screen.findByRole('button', { name: 'switch datasource A' }));

    expect(await screen.findByTestId('is-open-A')).toHaveTextContent('true');
  });

  it('reopens a row that was manually collapsed after it had been opened once, on the next datasource switch', async () => {
    const { panel, cell } = buildPanel([{ expr: 'up', datasource: { uid: 'default-uid', type: 'testdata' } }]);
    const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

    await user.click(await screen.findByRole('button', { name: 'switch datasource A' }));
    expect(await screen.findByTestId('is-open-A')).toHaveTextContent('true');

    await user.click(await screen.findByRole('button', { name: 'collapse query A' }));
    expect(await screen.findByTestId('is-open-A')).toHaveTextContent('false');

    await user.click(await screen.findByRole('button', { name: 'switch datasource A' }));

    expect(await screen.findByTestId('is-open-A')).toHaveTextContent('true');
  });

  it('runs the query from the Run button', async () => {
    const { panel, cell } = buildPanel();
    const runner = getQueryRunnerFor(panel)!;
    const runQueries = jest.spyOn(runner, 'runQueries');
    const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

    await user.click(await screen.findByRole('button', { name: 'Run query' }));

    expect(runQueries).toHaveBeenCalled();
  });

  it('runs the query from the row itself', async () => {
    const { panel, cell } = buildPanel();
    const runner = getQueryRunnerFor(panel)!;
    const runQueries = jest.spyOn(runner, 'runQueries');
    const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

    await user.click(await screen.findByRole('button', { name: 'run from row A' }));

    expect(runQueries).toHaveBeenCalled();
  });

  // Real dashboards pick the panel's visualization from the query's own result shape (see
  // UnconfiguredPanel's "Use saved query" button) rather than assuming a fixed viz type — a query
  // returning tabular data (e.g. a CSV with no time field) would otherwise land on a timeseries panel
  // that can only say "Data is missing a time field".
  it('applies the suggested visualization before running the query', async () => {
    const { panel, cell } = buildPanel();
    const runner = getQueryRunnerFor(panel)!;
    const runQueries = jest.spyOn(runner, 'runQueries');
    const changePluginType = jest.spyOn(panel, 'changePluginType').mockResolvedValue(undefined);
    getVizSuggestionForQuery.mockResolvedValue({ pluginId: 'table', options: { showHeader: true } });
    const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

    await user.click(await screen.findByRole('button', { name: 'Run query' }));

    await waitFor(() => expect(runQueries).toHaveBeenCalled());
    expect(getVizSuggestionForQuery).toHaveBeenCalledWith(runner.state.queries[0], expect.anything());
    expect(changePluginType).toHaveBeenCalledWith('table', { showHeader: true }, undefined);
    // The real run must come after the plugin swap, not before — a viz change mid-flight after data
    // has already arrived would otherwise briefly render the old plugin against new data.
    expect(changePluginType.mock.invocationCallOrder[0]).toBeLessThan(runQueries.mock.invocationCallOrder[0]);
  });

  it('still runs the query when the suggestion fails', async () => {
    const { panel, cell } = buildPanel();
    const runner = getQueryRunnerFor(panel)!;
    const runQueries = jest.spyOn(runner, 'runQueries');
    // Expected and logged, not swallowed silently — see PanelQueryEditor's own catch block.
    jest.spyOn(console, 'error').mockImplementation(() => {});
    getVizSuggestionForQuery.mockRejectedValue(new Error('datasource unreachable'));
    const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

    await user.click(await screen.findByRole('button', { name: 'Run query' }));

    await waitFor(() => expect(runQueries).toHaveBeenCalled());
  });

  it('does not re-fetch the suggestion on a repeat click with an unchanged query', async () => {
    const { panel, cell } = buildPanel();
    const runner = getQueryRunnerFor(panel)!;
    const runQueries = jest.spyOn(runner, 'runQueries');
    const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);
    const runButton = await screen.findByRole('button', { name: 'Run query' });

    await user.click(runButton);
    await waitFor(() => expect(runQueries).toHaveBeenCalledTimes(1));

    await user.click(runButton);
    await waitFor(() => expect(runQueries).toHaveBeenCalledTimes(2));

    // The query itself hasn't changed between clicks, so the (query-running) suggestion fetch only
    // has to happen once — the second "Run query" click should go straight to the real run.
    expect(getVizSuggestionForQuery).toHaveBeenCalledTimes(1);
  });

  it('fetches a fresh suggestion after the query changes', async () => {
    const { panel, cell } = buildPanel();
    const runner = getQueryRunnerFor(panel)!;
    const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

    await user.click(await screen.findByRole('button', { name: 'Run query' }));
    await waitFor(() => expect(getVizSuggestionForQuery).toHaveBeenCalledTimes(1));

    await user.click(await screen.findByRole('button', { name: 'edit query A' }));
    await user.click(await screen.findByRole('button', { name: 'Run query' }));

    await waitFor(() => expect(getVizSuggestionForQuery).toHaveBeenCalledTimes(2));
    expect(getVizSuggestionForQuery).toHaveBeenNthCalledWith(2, runner.state.queries[0], expect.anything());
  });

  it('retries the suggestion fetch after a previous attempt failed', async () => {
    const { panel, cell } = buildPanel();
    const runner = getQueryRunnerFor(panel)!;
    const runQueries = jest.spyOn(runner, 'runQueries');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    getVizSuggestionForQuery.mockRejectedValueOnce(new Error('datasource unreachable'));
    const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);
    const runButton = await screen.findByRole('button', { name: 'Run query' });

    await user.click(runButton);
    await waitFor(() => expect(runQueries).toHaveBeenCalledTimes(1));

    await user.click(runButton);
    await waitFor(() => expect(runQueries).toHaveBeenCalledTimes(2));

    // A fetch that failed must not be cached as "already suggested" — it's retried on the next click.
    expect(getVizSuggestionForQuery).toHaveBeenCalledTimes(2);
  });

  it('renders nothing for a panel with no query runner', () => {
    const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });
    const { container } = render(<PanelQueryEditor panel={panel} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('still writes queries when rendered without an owning cell', async () => {
    const { panel } = buildPanel();
    const runner = getQueryRunnerFor(panel)!;
    const { user } = render(<PanelQueryEditor panel={panel} />);

    await user.click(await screen.findByRole('button', { name: 'edit query A' }));

    expect(runner.state.queries[0]).toEqual(expect.objectContaining({ expr: 'up' }));
  });

  describe('row collapse state', () => {
    it('starts collapsed by default', async () => {
      const { panel, cell } = buildPanel();
      render(<PanelQueryEditor panel={panel} cell={cell} />);

      expect(await screen.findByTestId('is-open-A')).toHaveTextContent('false');
    });

    // autoFocus is true right after this cell was just inserted or converted — see
    // NotebookCellRenderer's own doc comment. Opening the row automatically then means the reader who
    // just added the block sees its editor immediately, instead of having to know to click a chevron.
    it('starts open when the cell was just added or converted', async () => {
      const { panel, cell } = buildPanel();
      render(<PanelQueryEditor panel={panel} cell={cell} autoFocus />);

      expect(await screen.findByTestId('is-open-A')).toHaveTextContent('true');
    });
  });

  describe('multiple queries', () => {
    it('renders one row per query', async () => {
      const { panel, cell } = buildPanel([{}, {}]);
      render(<PanelQueryEditor panel={panel} cell={cell} />);

      expect(await screen.findByTestId('row-A')).toBeInTheDocument();
      expect(screen.getByTestId('row-B')).toBeInTheDocument();
    });

    it('adds a fresh query via the header button, without touching the existing one', async () => {
      const { panel, cell } = buildPanel();
      const runner = getQueryRunnerFor(panel)!;
      const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);
      const before = runner.state.queries[0];

      await user.click(await screen.findByRole('button', { name: 'Add query' }));

      expect(runner.state.queries).toHaveLength(2);
      expect(runner.state.queries[0]).toBe(before);
      expect(runner.state.queries[1]).toEqual(expect.objectContaining({ refId: 'B', hide: false }));
      // Neither row has a datasource yet in this fixture, so there's nothing to inherit — see the
      // next test for the case that actually exercises the hint.
      expect(runner.state.queries[1].datasource).toBeUndefined();
    });

    // Regression: a bare addQuery(queries) with no datasource hint used to leave the new row's
    // datasource undefined, which setQueryRunnerQueries then treated as a distinct uid from the
    // existing real one — flipping the runner to Mixed even though only one real datasource was ever
    // in play, and Mixed can't dispatch a target with no datasource of its own.
    it('gives a newly added query the existing datasource, so the runner does not flip to Mixed', async () => {
      const { panel, cell } = buildPanel([{ datasource: { uid: 'default-uid', type: 'testdata' } }]);
      const runner = getQueryRunnerFor(panel)!;
      const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

      await user.click(await screen.findByRole('button', { name: 'Add query' }));

      expect(runner.state.queries).toHaveLength(2);
      expect(runner.state.queries[1].datasource).toEqual({ uid: 'default-uid', type: 'testdata' });
      expect(runner.state.datasource).toEqual({ uid: 'default-uid', type: 'testdata' });
    });

    it('duplicates a query via its own row action, with a fresh refId', async () => {
      const { panel, cell } = buildPanel([{ expr: 'up' }]);
      const runner = getQueryRunnerFor(panel)!;
      const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

      await user.click(await screen.findByRole('button', { name: 'duplicate query A' }));

      expect(runner.state.queries).toHaveLength(2);
      expect(runner.state.queries[1]).toEqual(expect.objectContaining({ refId: 'B', expr: 'up' }));
    });

    it('removes a query via its own row action', async () => {
      const { panel, cell } = buildPanel([{}, {}]);
      const runner = getQueryRunnerFor(panel)!;
      const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

      await user.click(await screen.findByRole('button', { name: 'remove query B' }));

      expect(runner.state.queries.map((q) => q.refId)).toEqual(['A']);
    });

    it('replaces a query via the saved-query action, keeping its refId', async () => {
      const { panel, cell } = buildPanel([{ expr: 'up' }]);
      const runner = getQueryRunnerFor(panel)!;
      const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

      await user.click(await screen.findByRole('button', { name: 'replace query A' }));

      expect(runner.state.queries).toHaveLength(1);
      expect(runner.state.queries[0]).toEqual(expect.objectContaining({ refId: 'A', expr: 'from-library' }));
    });

    it('replaces a query with several from a saved entry, assigning fresh refIds to the rest', async () => {
      const { panel, cell } = buildPanel([{ expr: 'up' }]);
      const runner = getQueryRunnerFor(panel)!;
      const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

      await user.click(await screen.findByRole('button', { name: 'replace with two queries A' }));

      expect(runner.state.queries).toHaveLength(2);
      expect(runner.state.queries[0]).toEqual(expect.objectContaining({ refId: 'A', expr: 'from-library-1' }));
      expect(runner.state.queries[1]).toEqual(expect.objectContaining({ refId: 'B', expr: 'from-library-2' }));
    });

    it('replacing one row from the library does not disturb the other', async () => {
      const { panel, cell } = buildPanel([{}, {}]);
      const runner = getQueryRunnerFor(panel)!;
      const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);
      const originalB = runner.state.queries[1];

      await user.click(await screen.findByRole('button', { name: 'replace query A' }));

      expect(runner.state.queries[0]).toEqual(expect.objectContaining({ refId: 'A', expr: 'from-library' }));
      expect(runner.state.queries[1]).toBe(originalB);
    });

    it('refuses to remove the last remaining query', async () => {
      const { panel, cell } = buildPanel();
      const runner = getQueryRunnerFor(panel)!;
      const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

      await user.click(await screen.findByRole('button', { name: 'remove query A' }));

      expect(runner.state.queries).toHaveLength(1);
    });

    it('edits one row without disturbing the other', async () => {
      const { panel, cell } = buildPanel([{}, {}]);
      const runner = getQueryRunnerFor(panel)!;
      const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);
      const originalB = runner.state.queries[1];

      await user.click(await screen.findByRole('button', { name: 'edit query A' }));

      expect(runner.state.queries[0]).toEqual(expect.objectContaining({ refId: 'A', expr: 'up' }));
      expect(runner.state.queries[1]).toBe(originalB);
    });

    // A regular datasource plugin ignores each query's own `datasource` field entirely — only the
    // "-- Mixed --" pseudo-datasource plugin looks at it and dispatches accordingly. So the moment two
    // rows point at different datasources, the runner-level one has to become Mixed, or the second
    // query would silently run against whatever the first row's datasource is instead of its own.
    it('flips the runner to the Mixed datasource once two rows diverge', async () => {
      const { panel, cell } = buildPanel([
        { datasource: { uid: 'default-uid', type: 'testdata' } },
        { datasource: { uid: 'default-uid', type: 'testdata' } },
      ]);
      const runner = getQueryRunnerFor(panel)!;
      const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

      await user.click(await screen.findByRole('button', { name: 'switch datasource B' }));

      expect(runner.state.queries[1].datasource).toEqual({ uid: 'other-uid', type: 'other-type' });
      expect(runner.state.datasource).toEqual({ uid: '-- Mixed --', type: 'mixed' });
    });

    it('collapses back off Mixed once every row shares a datasource again', async () => {
      const { panel, cell } = buildPanel([
        { datasource: { uid: 'default-uid', type: 'testdata' } },
        { datasource: { uid: 'other-uid', type: 'other-type' } },
      ]);
      const runner = getQueryRunnerFor(panel)!;
      expect(runner.state.datasource).toEqual({ uid: '-- Mixed --', type: 'mixed' });
      const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

      await user.click(await screen.findByRole('button', { name: 'remove query B' }));

      expect(runner.state.queries).toHaveLength(1);
      expect(runner.state.datasource).toEqual({ uid: 'default-uid', type: 'testdata' });
    });
  });

  describe('undo/redo', () => {
    it('records editing a query as an undoable step', async () => {
      const { panel, cell, history } = buildPanel();
      const runner = getQueryRunnerFor(panel)!;
      const before = runner.state.queries[0];
      const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

      await user.click(await screen.findByRole('button', { name: 'edit query A' }));

      expect(history.state.canUndo).toBe(true);
      expect(history.state.undoLabel).toBe('Edit query');

      act(() => history.undo());
      expect(runner.state.queries[0]).toEqual(before);
      expect(history.state.canRedo).toBe(true);

      act(() => history.redo());
      expect(runner.state.queries[0]).toEqual(expect.objectContaining({ expr: 'up' }));
    });

    it('coalesces rapid edits to the same row into one undo step', async () => {
      const { panel, cell, history } = buildPanel();
      const runner = getQueryRunnerFor(panel)!;
      const before = runner.state.queries[0];
      const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);
      const editButton = await screen.findByRole('button', { name: 'edit query A' });

      await user.click(editButton);
      await user.click(editButton);

      expect(history.state.undoLabel).toBe('Edit query');
      act(() => history.undo());
      expect(runner.state.queries[0]).toEqual(before);
      // One undo step took it all the way back — a separate step per click would have needed two.
      expect(history.state.canUndo).toBe(false);
    });

    it('undoes adding a query', async () => {
      const { panel, cell, history } = buildPanel();
      const runner = getQueryRunnerFor(panel)!;
      const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

      await user.click(await screen.findByRole('button', { name: 'Add query' }));

      expect(history.state.undoLabel).toBe('Add query');
      act(() => history.undo());
      expect(runner.state.queries).toHaveLength(1);

      act(() => history.redo());
      expect(runner.state.queries).toHaveLength(2);
    });

    it('undoes duplicating a query', async () => {
      const { panel, cell, history } = buildPanel([{ expr: 'up' }]);
      const runner = getQueryRunnerFor(panel)!;
      const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

      await user.click(await screen.findByRole('button', { name: 'duplicate query A' }));

      expect(history.state.undoLabel).toBe('Duplicate query');
      act(() => history.undo());
      expect(runner.state.queries.map((q) => q.refId)).toEqual(['A']);
    });

    it('undoes selecting a saved query', async () => {
      const { panel, cell, history } = buildPanel([{ expr: 'up' }]);
      const runner = getQueryRunnerFor(panel)!;
      const before = runner.state.queries[0];
      const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

      await user.click(await screen.findByRole('button', { name: 'replace query A' }));

      expect(history.state.undoLabel).toBe('Select query');
      act(() => history.undo());
      expect(runner.state.queries[0]).toEqual(before);
    });

    it('undoes removing a query', async () => {
      const { panel, cell, history } = buildPanel([{}, {}]);
      const runner = getQueryRunnerFor(panel)!;
      const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

      await user.click(await screen.findByRole('button', { name: 'remove query B' }));

      expect(history.state.undoLabel).toBe('Remove query');
      act(() => history.undo());
      expect(runner.state.queries.map((q) => q.refId)).toEqual(['A', 'B']);
    });

    it('undoes switching a row’s datasource', async () => {
      const { panel, cell, history } = buildPanel([{ datasource: { uid: 'default-uid', type: 'testdata' } }]);
      const runner = getQueryRunnerFor(panel)!;
      const before = runner.state.queries[0].datasource;
      const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

      await user.click(await screen.findByRole('button', { name: 'switch datasource A' }));

      expect(history.state.undoLabel).toBe('Switch datasource');
      act(() => history.undo());
      expect(runner.state.queries[0].datasource).toEqual(before);
    });

    it('does not coalesce a datasource switch with an in-flight text edit on the same row', async () => {
      const { panel, cell, history } = buildPanel([{ datasource: { uid: 'default-uid', type: 'testdata' } }]);
      const { user } = render(<PanelQueryEditor panel={panel} cell={cell} />);

      await user.click(await screen.findByRole('button', { name: 'edit query A' }));
      await user.click(await screen.findByRole('button', { name: 'switch datasource A' }));

      expect(history.state.undoLabel).toBe('Switch datasource');
      act(() => history.undo());
      expect(history.state.undoLabel).toBe('Edit query');
    });
  });
});
