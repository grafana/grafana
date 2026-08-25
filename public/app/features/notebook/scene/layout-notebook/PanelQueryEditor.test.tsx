import { render, screen, waitFor } from 'test/test-utils';

import { type DataQuery, type DataSourceInstanceSettings, type DataSourceRef } from '@grafana/data';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { buildVizPanelState } from 'app/features/dashboard-scene/serialization/layoutSerializers/utils';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/utils';
import { defaultQueryPanelKind } from 'app/features/notebook/types';

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
    onChange,
    onChangeDataSource,
    onRunQuery,
    onAddQuery,
    onRemoveQuery,
    isOpen,
  }: {
    dataSource: DataSourceInstanceSettings;
    query: DataQuery;
    onChange: (query: DataQuery) => void;
    onChangeDataSource?: (settings: DataSourceInstanceSettings) => void;
    onRunQuery: () => void;
    onAddQuery: (query: DataQuery) => void;
    onRemoveQuery: (query: DataQuery) => void;
    isOpen?: boolean;
  }) => (
    <div data-testid={`row-${query.refId}`}>
      <span data-testid={`resolved-datasource-${query.refId}`}>{dataSource.uid}</span>
      <span data-testid={`current-query-${query.refId}`}>{JSON.stringify(query)}</span>
      <span data-testid={`is-open-${query.refId}`}>{String(Boolean(isOpen))}</span>
      <button onClick={() => onChange({ ...query, expr: 'up' } as DataQuery)}>edit query {query.refId}</button>
      {onChangeDataSource && (
        <button
          onClick={() => onChangeDataSource({ uid: 'other-uid', type: 'other-type' } as DataSourceInstanceSettings)}
        >
          switch datasource {query.refId}
        </button>
      )}
      <button onClick={onRunQuery}>run from row {query.refId}</button>
      {/* Mirrors the real row's onCopyQuery: hands the same query back to onAddQuery, refId
          untouched — proving the wiring (not this stub) is what assigns a fresh one. */}
      <button onClick={() => onAddQuery(query)}>duplicate query {query.refId}</button>
      <button onClick={() => onRemoveQuery(query)}>remove query {query.refId}</button>
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

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceSettings: jest.fn(async (ref?: DataSourceRef | string) => settingsForRef(ref)),
  useDataSourceInstanceSettings: (ref?: DataSourceRef | string) => ({
    isLoading: false,
    settings: settingsForRef(ref),
  }),
}));

/**
 * A real Panel VizPanel, built the same way NotebookLayoutManager's buildQueryPanel does — parented
 * under a scene that carries a $timeRange, since PanelQueryEditor reads the panel's own SceneQueryRunner
 * and the shared time range straight off the scene graph rather than through props.
 *
 * `queries`, when given, fully replaces the panel's single default query — one partial per row,
 * each assigned its own refId (A, B, C, ...) so multi-row tests can address a specific one.
 */
function buildPanel(queries?: Array<Record<string, unknown>>) {
  const panel = new VizPanel(buildVizPanelState(defaultQueryPanelKind(), 1));
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

  new NotebookScene({
    title: 'Test notebook',
    body: new NotebookLayoutManager({
      cells: [new NotebookCellItem({ elementName: 'query-1', source: 'user', body: panel })],
    }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });

  return panel;
}

beforeEach(() => {
  resolvedSettings = { uid: 'default-uid', type: 'testdata', name: 'gdev-testdata' };
  getVizSuggestionForQuery.mockReset().mockResolvedValue(undefined);
});

describe('PanelQueryEditor', () => {
  it('resolves the panel’s own query datasource', async () => {
    const panel = buildPanel();
    render(<PanelQueryEditor panel={panel} />);

    expect(await screen.findByTestId('resolved-datasource-A')).toHaveTextContent('default-uid');
  });

  it('offers a datasource picker when nothing resolves', async () => {
    resolvedSettings = undefined;
    const panel = buildPanel();
    render(<PanelQueryEditor panel={panel} />);

    expect(await screen.findByRole('button', { name: 'pick a datasource' })).toBeInTheDocument();
    expect(screen.queryByTestId('resolved-datasource-A')).not.toBeInTheDocument();
  });

  it('writes a picked datasource straight onto the runner', async () => {
    resolvedSettings = undefined;
    const panel = buildPanel();
    const runner = getQueryRunnerFor(panel)!;
    const { user } = render(<PanelQueryEditor panel={panel} />);

    await user.click(await screen.findByRole('button', { name: 'pick a datasource' }));

    expect(runner.state.queries[0].datasource).toEqual({ uid: 'picked-uid', type: 'picked-type' });
    // The runner-level datasource, not just the query's own field, has to stay in sync — a regular
    // datasource plugin ignores each query's own `datasource` field and just runs everything against
    // whatever the runner itself points at (see setQueryRunnerQueries's own comment).
    expect(runner.state.datasource).toEqual({ uid: 'picked-uid', type: 'picked-type' });
  });

  it('opens the row once a datasource is picked for the first time', async () => {
    resolvedSettings = undefined;
    const panel = buildPanel();
    const { user } = render(<PanelQueryEditor panel={panel} />);
    const pickButton = await screen.findByRole('button', { name: 'pick a datasource' });
    // Only resolves *after* the picker has had its chance to render — this mock has no per-ref
    // control, only a single global on/off switch.
    resolvedSettings = { uid: 'picked-uid', type: 'picked-type', name: 'picked' };

    await user.click(pickButton);

    expect(await screen.findByTestId('is-open-A')).toHaveTextContent('true');
  });

  it('preserves refId and hide when the query editor reports an edit', async () => {
    const panel = buildPanel();
    const runner = getQueryRunnerFor(panel)!;
    const { user } = render(<PanelQueryEditor panel={panel} />);

    await user.click(await screen.findByRole('button', { name: 'edit query A' }));

    expect(runner.state.queries[0]).toEqual(expect.objectContaining({ refId: 'A', hide: false, expr: 'up' }));
  });

  it('switches datasource from the row header without losing the query spec', async () => {
    const panel = buildPanel([{ expr: 'up', datasource: { uid: 'default-uid', type: 'testdata' } }]);
    const runner = getQueryRunnerFor(panel)!;
    const { user } = render(<PanelQueryEditor panel={panel} />);

    await user.click(await screen.findByRole('button', { name: 'switch datasource A' }));

    expect(runner.state.queries[0]).toEqual(
      expect.objectContaining({ expr: 'up', datasource: { uid: 'other-uid', type: 'other-type' } })
    );
  });

  it('runs the query from the Run button', async () => {
    const panel = buildPanel();
    const runner = getQueryRunnerFor(panel)!;
    const runQueries = jest.spyOn(runner, 'runQueries');
    const { user } = render(<PanelQueryEditor panel={panel} />);

    await user.click(await screen.findByRole('button', { name: 'Run query' }));

    expect(runQueries).toHaveBeenCalled();
  });

  it('runs the query from the row itself', async () => {
    const panel = buildPanel();
    const runner = getQueryRunnerFor(panel)!;
    const runQueries = jest.spyOn(runner, 'runQueries');
    const { user } = render(<PanelQueryEditor panel={panel} />);

    await user.click(await screen.findByRole('button', { name: 'run from row A' }));

    expect(runQueries).toHaveBeenCalled();
  });

  // Real dashboards pick the panel's visualization from the query's own result shape (see
  // UnconfiguredPanel's "Use saved query" button) rather than assuming a fixed viz type — a query
  // returning tabular data (e.g. a CSV with no time field) would otherwise land on a timeseries panel
  // that can only say "Data is missing a time field".
  it('applies the suggested visualization before running the query', async () => {
    const panel = buildPanel();
    const runner = getQueryRunnerFor(panel)!;
    const runQueries = jest.spyOn(runner, 'runQueries');
    const changePluginType = jest.spyOn(panel, 'changePluginType').mockResolvedValue(undefined);
    getVizSuggestionForQuery.mockResolvedValue({ pluginId: 'table', options: { showHeader: true } });
    const { user } = render(<PanelQueryEditor panel={panel} />);

    await user.click(await screen.findByRole('button', { name: 'Run query' }));

    await waitFor(() => expect(runQueries).toHaveBeenCalled());
    expect(getVizSuggestionForQuery).toHaveBeenCalledWith(runner.state.queries[0], expect.anything());
    expect(changePluginType).toHaveBeenCalledWith('table', { showHeader: true }, undefined);
    // The real run must come after the plugin swap, not before — a viz change mid-flight after data
    // has already arrived would otherwise briefly render the old plugin against new data.
    expect(changePluginType.mock.invocationCallOrder[0]).toBeLessThan(runQueries.mock.invocationCallOrder[0]);
  });

  it('still runs the query when the suggestion fails', async () => {
    const panel = buildPanel();
    const runner = getQueryRunnerFor(panel)!;
    const runQueries = jest.spyOn(runner, 'runQueries');
    // Expected and logged, not swallowed silently — see PanelQueryEditor's own catch block.
    jest.spyOn(console, 'error').mockImplementation(() => {});
    getVizSuggestionForQuery.mockRejectedValue(new Error('datasource unreachable'));
    const { user } = render(<PanelQueryEditor panel={panel} />);

    await user.click(await screen.findByRole('button', { name: 'Run query' }));

    await waitFor(() => expect(runQueries).toHaveBeenCalled());
  });

  it('renders nothing for a panel with no query runner', () => {
    const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });
    const { container } = render(<PanelQueryEditor panel={panel} />);

    expect(container).toBeEmptyDOMElement();
  });

  describe('row collapse state', () => {
    it('starts collapsed by default', async () => {
      const panel = buildPanel();
      render(<PanelQueryEditor panel={panel} />);

      expect(await screen.findByTestId('is-open-A')).toHaveTextContent('false');
    });

    // autoFocus is true right after this cell was just inserted or converted — see
    // NotebookCellRenderer's own doc comment. Opening the row automatically then means the reader who
    // just added the block sees its editor immediately, instead of having to know to click a chevron.
    it('starts open when the cell was just added or converted', async () => {
      const panel = buildPanel();
      render(<PanelQueryEditor panel={panel} autoFocus />);

      expect(await screen.findByTestId('is-open-A')).toHaveTextContent('true');
    });
  });

  describe('multiple queries', () => {
    it('renders one row per query', async () => {
      const panel = buildPanel([{}, {}]);
      render(<PanelQueryEditor panel={panel} />);

      expect(await screen.findByTestId('row-A')).toBeInTheDocument();
      expect(screen.getByTestId('row-B')).toBeInTheDocument();
    });

    it('adds a fresh query via the header button, without touching the existing one', async () => {
      const panel = buildPanel();
      const runner = getQueryRunnerFor(panel)!;
      const { user } = render(<PanelQueryEditor panel={panel} />);
      const before = runner.state.queries[0];

      await user.click(await screen.findByRole('button', { name: 'Add query' }));

      expect(runner.state.queries).toHaveLength(2);
      expect(runner.state.queries[0]).toBe(before);
      expect(runner.state.queries[1]).toEqual(expect.objectContaining({ refId: 'B', hide: false }));
      expect(runner.state.queries[1].datasource).toBeUndefined();
    });

    it('duplicates a query via its own row action, with a fresh refId', async () => {
      const panel = buildPanel([{ expr: 'up' }]);
      const runner = getQueryRunnerFor(panel)!;
      const { user } = render(<PanelQueryEditor panel={panel} />);

      await user.click(await screen.findByRole('button', { name: 'duplicate query A' }));

      expect(runner.state.queries).toHaveLength(2);
      expect(runner.state.queries[1]).toEqual(expect.objectContaining({ refId: 'B', expr: 'up' }));
    });

    it('removes a query via its own row action', async () => {
      const panel = buildPanel([{}, {}]);
      const runner = getQueryRunnerFor(panel)!;
      const { user } = render(<PanelQueryEditor panel={panel} />);

      await user.click(await screen.findByRole('button', { name: 'remove query B' }));

      expect(runner.state.queries.map((q) => q.refId)).toEqual(['A']);
    });

    it('refuses to remove the last remaining query', async () => {
      const panel = buildPanel();
      const runner = getQueryRunnerFor(panel)!;
      const { user } = render(<PanelQueryEditor panel={panel} />);

      await user.click(await screen.findByRole('button', { name: 'remove query A' }));

      expect(runner.state.queries).toHaveLength(1);
    });

    it('edits one row without disturbing the other', async () => {
      const panel = buildPanel([{}, {}]);
      const runner = getQueryRunnerFor(panel)!;
      const { user } = render(<PanelQueryEditor panel={panel} />);
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
      const panel = buildPanel([
        { datasource: { uid: 'default-uid', type: 'testdata' } },
        { datasource: { uid: 'default-uid', type: 'testdata' } },
      ]);
      const runner = getQueryRunnerFor(panel)!;
      const { user } = render(<PanelQueryEditor panel={panel} />);

      await user.click(await screen.findByRole('button', { name: 'switch datasource B' }));

      expect(runner.state.queries[1].datasource).toEqual({ uid: 'other-uid', type: 'other-type' });
      expect(runner.state.datasource).toEqual({ uid: '-- Mixed --', type: 'mixed' });
    });

    it('collapses back off Mixed once every row shares a datasource again', async () => {
      const panel = buildPanel([
        { datasource: { uid: 'default-uid', type: 'testdata' } },
        { datasource: { uid: 'other-uid', type: 'other-type' } },
      ]);
      const runner = getQueryRunnerFor(panel)!;
      expect(runner.state.datasource).toEqual({ uid: '-- Mixed --', type: 'mixed' });
      const { user } = render(<PanelQueryEditor panel={panel} />);

      await user.click(await screen.findByRole('button', { name: 'remove query B' }));

      expect(runner.state.queries).toHaveLength(1);
      expect(runner.state.datasource).toEqual({ uid: 'default-uid', type: 'testdata' });
    });
  });
});
