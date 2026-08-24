import { type ReactNode } from 'react';
import { act, render, screen, waitFor, within } from 'test/test-utils';

import {
  type DataFrame,
  type DataQuery,
  type DataSourceInstanceSettings,
  type DataSourceRef,
  dateTime,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  type TimeRange,
} from '@grafana/data';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';
import { type CellContentKind } from 'app/features/notebook/types';

import { NotebookScene } from '../../NotebookScene';
import { NotebookCellItem } from '../NotebookCellItem';
import { NotebookLayoutManager } from '../NotebookLayoutManager';

import { QueryCell } from './QueryCell';

// QueryEditorRow pulls in real datasource plugin loading (DataSourcePluginContextProvider, the
// plugin's own QueryEditor component) to render anything meaningful — none of which runs in jsdom.
// The stub exposes just enough of its contract for this file's assertions: the resolved datasource,
// the current query, and the callbacks QueryCell wires to it.
jest.mock('app/features/query/components/QueryEditorRow', () => ({
  QueryEditorRow: ({
    dataSource,
    query,
    onChange,
    onChangeDataSource,
    onRunQuery,
    hideActionButtons,
    collapsable,
    isOpen,
    renderHeaderExtras,
  }: {
    dataSource: DataSourceInstanceSettings;
    query: DataQuery;
    onChange: (query: DataQuery) => void;
    onChangeDataSource?: (settings: DataSourceInstanceSettings) => void;
    onRunQuery: () => void;
    hideActionButtons?: boolean;
    collapsable?: boolean;
    isOpen?: boolean;
    renderHeaderExtras?: () => ReactNode;
  }) => (
    <div>
      <span data-testid="resolved-datasource">{dataSource.uid}</span>
      <span data-testid="current-query">{JSON.stringify(query)}</span>
      <span data-testid="hide-action-buttons">{String(Boolean(hideActionButtons))}</span>
      <span data-testid="collapsable">{String(Boolean(collapsable))}</span>
      <span data-testid="is-open">{String(Boolean(isOpen))}</span>
      <span data-testid="can-change-datasource">{String(Boolean(onChangeDataSource))}</span>
      {renderHeaderExtras?.()}
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
  DataSourcePicker: ({
    onChange,
    disabled,
  }: {
    onChange: (settings: DataSourceInstanceSettings) => void;
    disabled?: boolean;
  }) => (
    <button
      disabled={disabled}
      onClick={() => onChange({ uid: 'picked-uid', type: 'picked-type' } as DataSourceInstanceSettings)}
    >
      pick a datasource
    </button>
  ),
}));

// jsdom does no layout, so AutoSizer would otherwise report a 0 width and the graph would never
// mount — same fix DashboardPicker.test.tsx and others already use for the same reason.
jest.mock('react-virtualized-auto-sizer', () => {
  return ({ children }: { children: (size: { width: number; height: number }) => ReactNode }) =>
    children({ width: 600, height: 300 });
});

// ExploreGraph -> PanelRenderer needs the whole panel-plugin loading pipeline (see e.g.
// PanelStylesSection.test.tsx's own note on this) — replaced with a stub that just proves the data
// (and graph style) this cell resolved actually reached it. PanelChrome/ExploreGraphLabel are left
// real: they're plain UI with no plugin-loading dependency, and ExploreGraphLabel's own real
// RadioButtonGroup is what these tests click through to exercise the style-change wiring.
jest.mock('app/features/explore/Graph/ExploreGraph', () => ({
  ExploreGraph: ({ data, graphStyle }: { data: DataFrame[]; graphStyle: string }) => (
    <div data-testid="graph" data-graph-style={graphStyle}>
      {data.length} series
    </div>
  ),
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
  // QueryCell reads settings through the hook; the hook's own call to getDataSourceInstanceSettings
  // is a relative import inside grafana-runtime, so mocking the package export is not enough.
  useDataSourceInstanceSettings: (ref?: DataSourceRef | string) => ({
    isLoading: false,
    settings: settingsForRef(ref),
  }),
}));

// PanelQueryRunner drives a real HTTP request chain — this cell only needs to prove it calls `run`
// with the right arguments and forwards whatever `getData` emits, so both are faked.
const mockRun = jest.fn().mockResolvedValue(undefined);
let emitData: ((data: PanelData) => void) | undefined;

jest.mock('app/features/query/state/PanelQueryRunner', () => ({
  PanelQueryRunner: jest.fn().mockImplementation(() => ({
    run: mockRun,
    getData: () => ({
      subscribe: (callback: (data: PanelData) => void) => {
        emitData = callback;
        return { unsubscribe: jest.fn() };
      },
    }),
  })),
}));

function emptyQueryContent(): CellContentKind {
  return {
    kind: 'Query',
    spec: {
      query: {
        kind: 'PanelQuery',
        spec: { query: { kind: 'DataQuery', group: '', version: 'v0', spec: {} }, refId: 'A', hidden: false },
      },
    },
  };
}

/** A cell that already carries a real, previously-saved query — as opposed to a freshly-inserted one. */
function savedQueryContent(): CellContentKind {
  return {
    kind: 'Query',
    spec: {
      query: {
        kind: 'PanelQuery',
        spec: {
          query: {
            kind: 'DataQuery',
            group: 'testdata',
            version: 'v0',
            datasource: { name: 'default-uid' },
            spec: { expr: 'up' },
          },
          refId: 'A',
          hidden: false,
        },
      },
    },
  };
}

const range = getDefaultTimeRange();

function absoluteRange(from: string, to: string): TimeRange {
  return { from: dateTime(from), to: dateTime(to), raw: { from, to } };
}

/**
 * QueryCell reads the notebook's shared time range directly off the scene graph
 * (sceneGraph.getTimeRange(cell)), so it needs a real NotebookCellItem parented under a scene that
 * carries a $timeRange — the same shape NotebookLayoutManagerRenderer gives it in production. `content`
 * isn't set on the cell itself: QueryCell never reads `cell.state.content` (only the `content` prop,
 * supplied separately in every render call below, matches production), so this cell exists purely as a
 * scene-graph anchor.
 *
 * When `range` is given, `.value` is forced to that exact object via `setState` rather than left to
 * SceneTimeRange's own `evaluateTimeRange` — tests assert against this same object, sidestepping any
 * risk of a "now"-relative recomputation drifting between construction and assertion.
 */
function buildCell(range?: TimeRange) {
  const timeRange = new SceneTimeRange(
    range ? { from: range.raw.from as string, to: range.raw.to as string } : { from: 'now-6h', to: 'now' }
  );
  if (range) {
    timeRange.setState({ value: range });
  }
  const cell = new NotebookCellItem({ elementName: 'query-1', source: 'user' });
  new NotebookScene({
    title: 'Test notebook',
    body: new NotebookLayoutManager({ cells: [cell] }),
    $timeRange: timeRange,
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });
  return { cell, timeRange };
}

beforeEach(() => {
  resolvedSettings = { uid: 'default-uid', type: 'testdata', name: 'gdev-testdata' };
  mockRun.mockClear();
  emitData = undefined;
});

describe('QueryCell', () => {
  it('renders nothing for a non-Query content kind', async () => {
    const other: CellContentKind = { kind: 'Code', spec: { code: 'select 1', language: 'sql' } };
    const { cell } = buildCell();
    const { container } = render(<QueryCell content={other} cell={cell} isEditing={true} onChange={jest.fn()} />);

    expect(container).toBeEmptyDOMElement();
    // The datasource-resolution effect still fires ahead of the content.kind guard (see QueryCell's
    // own comment on why) — flushed here so its resolution doesn't land on an unmounted tree instead
    // of during this test's own act().
    await act(async () => {});
  });

  it('resolves the org default datasource for an untouched cell, matching a fresh Explore pane', async () => {
    const { cell } = buildCell();
    render(<QueryCell content={emptyQueryContent()} cell={cell} isEditing={true} onChange={jest.fn()} />);

    expect(await screen.findByTestId('resolved-datasource')).toHaveTextContent('default-uid');
  });

  it('offers a datasource picker when nothing resolves', async () => {
    resolvedSettings = undefined;
    const { cell } = buildCell();
    render(<QueryCell content={emptyQueryContent()} cell={cell} isEditing={true} onChange={jest.fn()} />);

    expect(await screen.findByRole('button', { name: 'pick a datasource' })).toBeInTheDocument();
    expect(screen.queryByTestId('resolved-datasource')).not.toBeInTheDocument();
  });

  it('persists a picked datasource onto the query, converting it to the k8s-shaped query kind', async () => {
    resolvedSettings = undefined;
    const onChange = jest.fn();
    const { cell } = buildCell();
    const { user } = render(
      <QueryCell content={emptyQueryContent()} cell={cell} isEditing={true} onChange={onChange} />
    );

    await user.click(await screen.findByRole('button', { name: 'pick a datasource' }));

    expect(onChange).toHaveBeenCalledWith({
      kind: 'Query',
      spec: {
        query: {
          kind: 'PanelQuery',
          spec: {
            refId: 'A',
            hidden: false,
            query: {
              kind: 'DataQuery',
              group: 'picked-type',
              version: 'v0',
              datasource: { name: 'picked-uid' },
              spec: {},
            },
          },
        },
      },
    });
  });

  it('preserves refId and hidden when the query editor reports an edit', async () => {
    const onChange = jest.fn();
    const { cell } = buildCell();
    const { user } = render(
      <QueryCell content={emptyQueryContent()} cell={cell} isEditing={true} onChange={onChange} />
    );

    await user.click(await screen.findByRole('button', { name: 'edit query' }));

    expect(onChange).toHaveBeenCalledWith({
      kind: 'Query',
      spec: {
        query: {
          kind: 'PanelQuery',
          spec: {
            refId: 'A',
            hidden: false,
            query: { kind: 'DataQuery', group: '', version: 'v0', spec: { expr: 'up' } },
          },
        },
      },
    });
  });

  it('switches datasource from the row header without losing the query spec', async () => {
    const content: CellContentKind = {
      kind: 'Query',
      spec: {
        query: {
          kind: 'PanelQuery',
          spec: {
            refId: 'A',
            hidden: false,
            query: {
              kind: 'DataQuery',
              group: 'testdata',
              version: 'v0',
              datasource: { name: 'default-uid' },
              spec: { expr: 'up' },
            },
          },
        },
      },
    };
    const onChange = jest.fn();
    const { cell } = buildCell();
    const { user } = render(<QueryCell content={content} cell={cell} isEditing={true} onChange={onChange} />);

    await user.click(await screen.findByRole('button', { name: 'switch datasource' }));

    expect(onChange).toHaveBeenCalledWith({
      kind: 'Query',
      spec: {
        query: {
          kind: 'PanelQuery',
          spec: {
            refId: 'A',
            hidden: false,
            query: {
              kind: 'DataQuery',
              group: 'other-type',
              version: 'v0',
              datasource: { name: 'other-uid' },
              spec: { expr: 'up' },
            },
          },
        },
      },
    });
  });

  // Duplicate/remove/reorder never do anything meaningful for a cell that only ever has one query —
  // the notebook cell's own actions already cover duplicate/delete. hideActionButtons is the only
  // lever QueryEditorRow exposes for this (see QueryCell's own comment on why help goes with it).
  it('hides the row-level duplicate/remove/drag actions', async () => {
    const { cell } = buildCell();
    render(<QueryCell content={emptyQueryContent()} cell={cell} isEditing={true} onChange={jest.fn()} />);

    expect(await screen.findByTestId('hide-action-buttons')).toHaveTextContent('true');
  });

  it('renders the Run button outside the query editor row, not through renderHeaderExtras', async () => {
    const { cell } = buildCell();
    render(<QueryCell content={emptyQueryContent()} cell={cell} isEditing={true} onChange={jest.fn()} />);

    // The mock only renders renderHeaderExtras' own return value inside its DOM — a Run button
    // appearing here would mean it went back through that slot instead of its own row.
    const editorRow = (await screen.findByTestId('resolved-datasource')).closest('div')!;
    expect(within(editorRow).queryByRole('button', { name: 'Run query' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run query' })).toBeInTheDocument();
  });

  describe('the query editor body’s visibility', () => {
    it('renders open, with a collapse chevron, in edit mode', async () => {
      const { cell } = buildCell();
      render(<QueryCell content={emptyQueryContent()} cell={cell} isEditing={true} onChange={jest.fn()} />);

      expect(await screen.findByTestId('is-open')).toHaveTextContent('true');
      expect(screen.getByTestId('collapsable')).toHaveTextContent('true');
    });

    // Reading a notebook should only ever show the header (datasource label, refId) plus the graph —
    // the query-builder body must not be reachable at all, so there's no chevron to reveal it
    // (`collapsable`) and the body itself never mounts (`isOpen`).
    it('never renders the body, or a way to reveal it, in view mode', async () => {
      const { cell } = buildCell();
      render(<QueryCell content={emptyQueryContent()} cell={cell} isEditing={false} onChange={jest.fn()} />);

      expect(await screen.findByTestId('is-open')).toHaveTextContent('false');
      expect(screen.getByTestId('collapsable')).toHaveTextContent('false');
    });

    // Cells aren't remounted when the whole notebook flips between edit and view, so this has to be
    // derived straight from `isEditing` on every render rather than seeded once — otherwise a cell
    // already mounted before a mode switch would keep showing (or hiding) its body regardless of the
    // new mode.
    it('hides the body when the notebook switches from edit to view mid-session', async () => {
      const { cell } = buildCell();
      const { rerender } = render(
        <QueryCell content={emptyQueryContent()} cell={cell} isEditing={true} onChange={jest.fn()} />
      );
      expect(await screen.findByTestId('is-open')).toHaveTextContent('true');

      rerender(<QueryCell content={emptyQueryContent()} cell={cell} isEditing={false} onChange={jest.fn()} />);

      expect(await screen.findByTestId('is-open')).toHaveTextContent('false');
      expect(screen.getByTestId('collapsable')).toHaveTextContent('false');
    });

    it('shows the body again when the notebook switches back from view to edit', async () => {
      const { cell } = buildCell();
      const { rerender } = render(
        <QueryCell content={emptyQueryContent()} cell={cell} isEditing={false} onChange={jest.fn()} />
      );
      expect(await screen.findByTestId('is-open')).toHaveTextContent('false');

      rerender(<QueryCell content={emptyQueryContent()} cell={cell} isEditing={true} onChange={jest.fn()} />);

      expect(await screen.findByTestId('is-open')).toHaveTextContent('true');
      expect(screen.getByTestId('collapsable')).toHaveTextContent('true');
    });
  });

  describe('while the notebook is being read, not edited', () => {
    it('omits the datasource-change handler, falling back to QueryEditorRow’s own read-only label', async () => {
      const { cell } = buildCell();
      render(<QueryCell content={emptyQueryContent()} cell={cell} isEditing={false} onChange={jest.fn()} />);

      expect(await screen.findByTestId('can-change-datasource')).toHaveTextContent('false');
      expect(screen.queryByRole('button', { name: 'switch datasource' })).not.toBeInTheDocument();
    });

    it('disables the standalone datasource picker before any datasource has ever been chosen', async () => {
      resolvedSettings = undefined;
      const { cell } = buildCell();
      render(<QueryCell content={emptyQueryContent()} cell={cell} isEditing={false} onChange={jest.fn()} />);

      expect(await screen.findByRole('button', { name: 'pick a datasource' })).toBeDisabled();
    });

    it('keeps the Run button enabled, so a reader can still refresh already-saved results', async () => {
      const { cell } = buildCell();
      render(<QueryCell content={savedQueryContent()} cell={cell} isEditing={false} onChange={jest.fn()} />);

      expect(await screen.findByRole('button', { name: 'Run query' })).toBeEnabled();
    });

    // The real component never mounts the query editor at all while reading (see the collapse
    // describe block above); this mock renders the "edit query" button unconditionally regardless of
    // `isOpen`, so it stands in here for "even if an edit somehow reached QueryEditorRow's onChange".
    it('never calls onChange for a query edit that slips past the collapsed body', async () => {
      const onChange = jest.fn();
      const { cell } = buildCell();
      const { user } = render(
        <QueryCell content={emptyQueryContent()} cell={cell} isEditing={false} onChange={onChange} />
      );

      await user.click(await screen.findByRole('button', { name: 'edit query' }));

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  it('auto-runs a cell that already has a saved query once its datasource resolves', async () => {
    const { cell } = buildCell();
    render(<QueryCell content={savedQueryContent()} cell={cell} isEditing={true} onChange={jest.fn()} />);

    await waitFor(() => expect(mockRun).toHaveBeenCalled());
    expect(mockRun).toHaveBeenCalledWith(
      expect.objectContaining({
        queries: [{ refId: 'A', hide: false, datasource: { uid: 'default-uid', type: 'testdata' }, expr: 'up' }],
      })
    );
  });

  it('does not auto-run a freshly-inserted cell with nothing to query yet', async () => {
    const { cell } = buildCell();
    render(<QueryCell content={emptyQueryContent()} cell={cell} isEditing={true} onChange={jest.fn()} />);

    await screen.findByTestId('resolved-datasource');
    // Give any wrongly-firing auto-run effect a turn to resolve before asserting its absence.
    await act(async () => {});
    expect(mockRun).not.toHaveBeenCalled();
  });

  // The auto-run effect waits for dsSettings, which arrives after mount — so it cannot key off a
  // live `hasQuery` without also firing the first time a freshly-inserted empty cell's spec is
  // written into (the first keystroke). That would hit the datasource with a still-incomplete query
  // instead of waiting for an explicit Run. The gate is "already saved at mount", not "has a query
  // now".
  it('does not auto-run when a freshly-inserted cell first gets a query spec written into it', async () => {
    const { cell } = buildCell();
    const { rerender } = render(
      <QueryCell content={emptyQueryContent()} cell={cell} isEditing={true} onChange={jest.fn()} />
    );

    await screen.findByTestId('resolved-datasource');
    await act(async () => {});
    expect(mockRun).not.toHaveBeenCalled();

    rerender(<QueryCell content={savedQueryContent()} cell={cell} isEditing={true} onChange={jest.fn()} />);

    await act(async () => {});
    expect(mockRun).not.toHaveBeenCalled();
  });

  // ExploreGraph's axis follows the notebook's own time range, so if the cell does not fetch again
  // the series stay from the previous window under the new axis. The first run is the auto-run of a
  // saved query; the second is the picker change this is pinning.
  it('re-runs a saved query when the notebook time range changes after auto-run', async () => {
    const morning = absoluteRange('2024-01-01T00:00:00Z', '2024-01-01T06:00:00Z');
    const afternoon = absoluteRange('2024-01-01T12:00:00Z', '2024-01-01T18:00:00Z');
    const { cell, timeRange } = buildCell(morning);
    render(<QueryCell content={savedQueryContent()} cell={cell} isEditing={true} onChange={jest.fn()} />);

    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));
    expect(mockRun).toHaveBeenCalledWith(expect.objectContaining({ timeRange: morning }));

    // Simulates the notebook's own time picker moving — QueryCell reads the range straight off this
    // same SceneTimeRange, so there's no prop to rerender with, only its state to change.
    act(() => {
      timeRange.setState({ value: afternoon });
    });

    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(2));
    expect(mockRun).toHaveBeenLastCalledWith(expect.objectContaining({ timeRange: afternoon }));
  });

  it('re-runs after an explicit Run when the notebook time range later changes', async () => {
    const morning = absoluteRange('2024-01-01T00:00:00Z', '2024-01-01T06:00:00Z');
    const afternoon = absoluteRange('2024-01-01T12:00:00Z', '2024-01-01T18:00:00Z');
    const { cell, timeRange } = buildCell(morning);
    const { user } = render(
      <QueryCell content={emptyQueryContent()} cell={cell} isEditing={true} onChange={jest.fn()} />
    );

    await user.click(await screen.findByRole('button', { name: 'Run query' }));
    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));

    act(() => {
      timeRange.setState({ value: afternoon });
    });

    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(2));
    expect(mockRun).toHaveBeenLastCalledWith(expect.objectContaining({ timeRange: afternoon }));
  });

  it('does not run an untouched cell just because the notebook time range changed', async () => {
    const morning = absoluteRange('2024-01-01T00:00:00Z', '2024-01-01T06:00:00Z');
    const afternoon = absoluteRange('2024-01-01T12:00:00Z', '2024-01-01T18:00:00Z');
    const { cell, timeRange } = buildCell(morning);
    render(<QueryCell content={emptyQueryContent()} cell={cell} isEditing={true} onChange={jest.fn()} />);

    await screen.findByTestId('resolved-datasource');
    await act(async () => {});
    expect(mockRun).not.toHaveBeenCalled();

    act(() => {
      timeRange.setState({ value: afternoon });
    });

    await act(async () => {});
    expect(mockRun).not.toHaveBeenCalled();
  });

  // The two gates have to stay distinct: auto-run is "already saved at mount", range re-run is
  // "this cell has already fetched once". Keying the picker effect off a live hasQuery would
  // re-open the first-keystroke bug through a different door — typing into an empty cell, then
  // nudging the picker, would hit the datasource without an explicit Run.
  it('does not run when a freshly-inserted cell is typed into and the time range then changes', async () => {
    const morning = absoluteRange('2024-01-01T00:00:00Z', '2024-01-01T06:00:00Z');
    const afternoon = absoluteRange('2024-01-01T12:00:00Z', '2024-01-01T18:00:00Z');
    const { cell, timeRange } = buildCell(morning);
    const { rerender } = render(
      <QueryCell content={emptyQueryContent()} cell={cell} isEditing={true} onChange={jest.fn()} />
    );

    await screen.findByTestId('resolved-datasource');
    await act(async () => {});
    expect(mockRun).not.toHaveBeenCalled();

    rerender(<QueryCell content={savedQueryContent()} cell={cell} isEditing={true} onChange={jest.fn()} />);
    act(() => {
      timeRange.setState({ value: afternoon });
    });

    await act(async () => {});
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('runs against the resolved datasource and the notebook time range', async () => {
    const { cell, timeRange } = buildCell();
    const { user } = render(
      <QueryCell content={emptyQueryContent()} cell={cell} isEditing={true} onChange={jest.fn()} />
    );

    await user.click(await screen.findByRole('button', { name: 'Run query' }));

    await waitFor(() => expect(mockRun).toHaveBeenCalled());
    expect(mockRun).toHaveBeenCalledWith(
      expect.objectContaining({
        datasource: { uid: 'default-uid', type: 'testdata' },
        queries: [{ refId: 'A', hide: false }],
        // The exact same object QueryCell itself read off the scene graph — asserting against a
        // freshly-computed "now-6h to now" range here would risk a real-clock drift false negative.
        timeRange: timeRange.state.value,
      })
    );
  });

  it('shows nothing where the graph goes before a query has ever run', async () => {
    const { cell } = buildCell();
    render(<QueryCell content={emptyQueryContent()} cell={cell} isEditing={true} onChange={jest.fn()} />);

    await screen.findByTestId('resolved-datasource');
    expect(screen.queryByTestId('graph')).not.toBeInTheDocument();
  });

  it('renders the graph once the runner emits data', async () => {
    const { cell } = buildCell();
    render(<QueryCell content={emptyQueryContent()} cell={cell} isEditing={true} onChange={jest.fn()} />);
    await screen.findByTestId('resolved-datasource');

    act(() => {
      emitData?.({ state: LoadingState.Done, series: [{ fields: [], length: 0 }], timeRange: range });
    });

    expect(await screen.findByTestId('graph')).toHaveTextContent('1 series');
  });

  it('defaults the graph style to lines for a cell that has never picked one', async () => {
    const { cell } = buildCell();
    render(<QueryCell content={emptyQueryContent()} cell={cell} isEditing={true} onChange={jest.fn()} />);
    await screen.findByTestId('resolved-datasource');

    act(() => {
      emitData?.({ state: LoadingState.Done, series: [{ fields: [], length: 0 }], timeRange: range });
    });

    expect(await screen.findByTestId('graph')).toHaveAttribute('data-graph-style', 'lines');
  });

  it('persists a graph style change while editing', async () => {
    const onChange = jest.fn();
    const { cell } = buildCell();
    const { user, rerender } = render(
      <QueryCell content={emptyQueryContent()} cell={cell} isEditing={true} onChange={onChange} />
    );
    await screen.findByTestId('resolved-datasource');
    act(() => {
      emitData?.({ state: LoadingState.Done, series: [{ fields: [], length: 0 }], timeRange: range });
    });

    await user.click(await screen.findByRole('radio', { name: 'Bars' }));

    // Fully controlled from `content`, same as the query text — clicking alone does not repaint the
    // graph; only the owner re-rendering with the persisted value does.
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'Query', spec: expect.objectContaining({ graphStyle: 'bars' }) })
    );

    const updated = onChange.mock.calls[0][0] as CellContentKind;
    rerender(<QueryCell content={updated} cell={cell} isEditing={true} onChange={onChange} />);

    expect(await screen.findByTestId('graph')).toHaveAttribute('data-graph-style', 'bars');
  });

  it('keeps a graph style change local while reading, without calling onChange', async () => {
    const onChange = jest.fn();
    const { cell } = buildCell();
    const { user } = render(
      <QueryCell content={savedQueryContent()} cell={cell} isEditing={false} onChange={onChange} />
    );
    await screen.findByTestId('resolved-datasource');
    act(() => {
      emitData?.({ state: LoadingState.Done, series: [{ fields: [], length: 0 }], timeRange: range });
    });

    await user.click(await screen.findByRole('radio', { name: 'Points' }));

    expect(await screen.findByTestId('graph')).toHaveAttribute('data-graph-style', 'points');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows an error alert instead of a graph when the run fails', async () => {
    const { cell } = buildCell();
    render(<QueryCell content={emptyQueryContent()} cell={cell} isEditing={true} onChange={jest.fn()} />);
    await screen.findByTestId('resolved-datasource');

    act(() => {
      emitData?.({
        state: LoadingState.Error,
        series: [],
        timeRange: range,
        errors: [{ message: 'boom' }],
      });
    });

    expect(await screen.findByText('boom')).toBeInTheDocument();
    expect(screen.queryByTestId('graph')).not.toBeInTheDocument();
  });
});
