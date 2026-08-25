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

// QueryEditorRow pulls in real datasource plugin loading (DataSourcePluginContextProvider, the
// plugin's own QueryEditor component) to render anything meaningful — none of which runs in jsdom.
// The stub exposes just enough of its contract for this file's assertions: the resolved datasource,
// the current query, and the callbacks PanelQueryEditor wires to it.
jest.mock('app/features/query/components/QueryEditorRow', () => ({
  QueryEditorRow: ({
    dataSource,
    query,
    onChange,
    onChangeDataSource,
    onRunQuery,
    hideActionButtons,
  }: {
    dataSource: DataSourceInstanceSettings;
    query: DataQuery;
    onChange: (query: DataQuery) => void;
    onChangeDataSource?: (settings: DataSourceInstanceSettings) => void;
    onRunQuery: () => void;
    hideActionButtons?: boolean;
  }) => (
    <div>
      <span data-testid="resolved-datasource">{dataSource.uid}</span>
      <span data-testid="current-query">{JSON.stringify(query)}</span>
      <span data-testid="hide-action-buttons">{String(Boolean(hideActionButtons))}</span>
      <button onClick={() => onChange({ ...query, expr: 'up' } as DataQuery)}>edit query</button>
      {onChangeDataSource && (
        <button
          onClick={() => onChangeDataSource({ uid: 'other-uid', type: 'other-type' } as DataSourceInstanceSettings)}
        >
          switch datasource
        </button>
      )}
      <button onClick={onRunQuery}>run from row</button>
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
 */
function buildPanel(query?: Record<string, unknown>) {
  const panel = new VizPanel(buildVizPanelState(defaultQueryPanelKind(), 1));
  if (query) {
    const runner = getQueryRunnerFor(panel)!;
    runner.setState({ queries: [{ ...runner.state.queries[0], ...query } as DataQuery] });
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

    expect(await screen.findByTestId('resolved-datasource')).toHaveTextContent('default-uid');
  });

  it('offers a datasource picker when nothing resolves', async () => {
    resolvedSettings = undefined;
    const panel = buildPanel();
    render(<PanelQueryEditor panel={panel} />);

    expect(await screen.findByRole('button', { name: 'pick a datasource' })).toBeInTheDocument();
    expect(screen.queryByTestId('resolved-datasource')).not.toBeInTheDocument();
  });

  it('writes a picked datasource straight onto the runner', async () => {
    resolvedSettings = undefined;
    const panel = buildPanel();
    const runner = getQueryRunnerFor(panel)!;
    const { user } = render(<PanelQueryEditor panel={panel} />);

    await user.click(await screen.findByRole('button', { name: 'pick a datasource' }));

    expect(runner.state.datasource).toEqual({ uid: 'picked-uid', type: 'picked-type' });
    expect(runner.state.queries[0].datasource).toEqual({ uid: 'picked-uid', type: 'picked-type' });
  });

  it('preserves refId and hide when the query editor reports an edit', async () => {
    const panel = buildPanel();
    const runner = getQueryRunnerFor(panel)!;
    const { user } = render(<PanelQueryEditor panel={panel} />);

    await user.click(await screen.findByRole('button', { name: 'edit query' }));

    expect(runner.state.queries[0]).toEqual(expect.objectContaining({ refId: 'A', hide: false, expr: 'up' }));
  });

  it('switches datasource from the row header without losing the query spec', async () => {
    const panel = buildPanel({ expr: 'up', datasource: { uid: 'default-uid', type: 'testdata' } });
    const runner = getQueryRunnerFor(panel)!;
    const { user } = render(<PanelQueryEditor panel={panel} />);

    await user.click(await screen.findByRole('button', { name: 'switch datasource' }));

    expect(runner.state.queries[0]).toEqual(
      expect.objectContaining({ expr: 'up', datasource: { uid: 'other-uid', type: 'other-type' } })
    );
  });

  it('hides the row-level duplicate/remove/drag actions', async () => {
    const panel = buildPanel();
    render(<PanelQueryEditor panel={panel} />);

    expect(await screen.findByTestId('hide-action-buttons')).toHaveTextContent('true');
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

    await user.click(await screen.findByRole('button', { name: 'run from row' }));

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
});
