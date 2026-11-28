import { act, render, screen, waitFor } from '@testing-library/react';
import { of } from 'rxjs';

import { toDataFrame, dateTime, LoadingState, type PanelData, type PanelProps } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils, setRunRequest } from '@grafana/runtime';
import { SceneQueryRunner, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { getMockDataSource } from 'app/features/query/state/mocks/mockDataSource';

import { QueryCoauthoringSessionEngine } from './QueryCoauthoringSessionEngine';
import { type QueryCoauthoringLanguage } from './queryCoauthoringContracts';
import captured from './testdata/prometheus-canonical-response.json';

const mockGetDataSource = jest.fn();
const mockGetPanelPlugin = jest.fn<ReturnType<typeof getPanelPlugin>, [string]>();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({ get: mockGetDataSource }),
  getDataSourceInstance: (...args: unknown[]) => mockGetDataSource(...args),
  getDataSourceInstanceSettings: async () => undefined,
}));

setPluginImportUtils({
  importPanelPlugin: async (id) => mockGetPanelPlugin(id),
  getPanelPluginFromCache: mockGetPanelPlugin,
});

it.each(['initial', 'published'] as const)(
  'keeps %s canonical health when the renderer clears previous Prometheus values',
  async (capture) => {
    const query = captured.request.queries[0];
    const range = {
      from: dateTime(Number(captured.request.from)),
      to: dateTime(Number(captured.request.to)),
      raw: { from: 'now-15m', to: 'now' },
    };
    const timeRange = new SceneTimeRange({ from: range.from.toISOString(), to: range.to.toISOString() });
    const data: PanelData = {
      state: LoadingState.Done,
      timeRange: range,
      request: {
        app: 'dashboard',
        requestId: 'SQR103',
        interval: '15s',
        intervalMs: 15000,
        scopedVars: {},
        startTime: Number(captured.request.to),
        timezone: 'browser',
        range,
        targets: [query],
      },
      series: captured.response.results.A.frames.map((frame) => toDataFrame(structuredClone(frame))),
    };
    const originalValues = captured.response.results.A.frames[0].data.values[1];
    const optionFrames = structuredClone(captured.response.results.A.frames);
    optionFrames[0].data.values[1] = originalValues.map((value) => 60 * value);
    const canonical = new SceneQueryRunner({
      queries: [query],
      datasource: query.datasource,
      data: capture === 'initial' ? data : undefined,
      runQueriesMode: 'manual',
      _hasFetchedData: true,
    });
    const panel = new VizPanel({
      key: 'panel-1',
      pluginId: 'canonical-health',
      $data: canonical,
      $timeRange: timeRange,
      _UNSAFE_clearPreviousFieldValues: true,
    });
    const plugin = getPanelPlugin({ id: 'canonical-health' }, ({ data }: PanelProps) => (
      <output data-testid="canonical-health">
        {JSON.stringify(data.series.map((frame) => frame.fields[1].values))}
      </output>
    ));
    mockGetPanelPlugin.mockReturnValue(plugin);
    const language: QueryCoauthoringLanguage<typeof query> = {
      version: 1,
      getQuerySupport: () => ({ editable: true }),
      describe: async (query) => ({ text: query.expr, language: { id: 'promql', displayName: 'PromQL' } }),
      prepare: (baseline, text) => ({
        status: 'ready',
        query: { ...baseline, expr: text },
        changes: [{ original: baseline.expr, proposed: text, originalRanges: [], proposedRanges: [] }],
      }),
    };
    mockGetDataSource.mockResolvedValue(Object.assign(getMockDataSource(), { queryCoauthoring: () => language }));
    setRunRequest((_datasource, request) =>
      of({
        ...data,
        request,
        series: optionFrames.map((frame) => toDataFrame(structuredClone(frame))),
      })
    );
    const engine = QueryCoauthoringSessionEngine.getOrCreate(panel);
    const session = engine.enter('A');
    const { unmount } = render(<panel.Component model={panel} />);
    try {
      if (capture === 'published') {
        act(() => canonical.setState({ data }));
      }
      await waitFor(() =>
        expect(screen.getByTestId('canonical-health')).toHaveTextContent(JSON.stringify([originalValues]))
      );
      expect(session.getState().health).toEqual({ A: 'ok' });
      let optionId = '';
      await act(async () => {
        const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: `60 * ${query.expr}` }] }], {
          baseRevision: 0,
          baseContextGeneration: session.getState().contextGeneration,
        });
        expect(result.status).toBe('staged');
        if (result.status === 'staged') {
          optionId = result.id;
        }
      });
      // VizPanel deliberately releases old field arrays after projecting a copied Original.
      expect(data.series[0].fields[1].values).toEqual([]);
      expect(screen.getByTestId('canonical-health')).toHaveTextContent(JSON.stringify([originalValues]));
      expect(engine.getCanonicalData()?.request?.requestId).toBe('SQR103');
      expect(engine.getCanonicalData()?.request?.range).toEqual(range);
      expect(engine.getCanonicalData()?.series[0].refId).toBe('A');
      expect(engine.getCanonicalData()?.series[0].fields[1].values.filter(Number.isFinite)).toHaveLength(61);
      expect(session.getState().health).toEqual({ A: 'ok' });
      expect(session.getState().problems).toEqual([]);
      act(() => {
        expect(session.preview(optionId)).toEqual({ ok: true });
      });
      expect(screen.getByTestId('canonical-health')).toHaveTextContent(
        JSON.stringify([optionFrames[0].data.values[1]])
      );
      expect(engine.getCanonicalData()?.series[0].fields[1].values).toEqual(originalValues);
      expect(session.getState().health).toEqual({ A: 'ok' });
      act(() => {
        expect(session.preview('original')).toEqual({ ok: true });
      });
      expect(screen.getByTestId('canonical-health')).toHaveTextContent(JSON.stringify([originalValues]));
      expect(session.getState().health).toEqual({ A: 'ok' });
      expect(session.getState().problems).toEqual([]);
      expect(engine.getCanonicalData()?.series[0].fields[1].values).toEqual(originalValues);

      const freshFrames = structuredClone(captured.response.results.A.frames);
      freshFrames[0].data.values[1] = [17, ...originalValues.slice(1)];
      const fresh = {
        ...data,
        request: data.request && { ...data.request, requestId: 'SQR105' },
        series: freshFrames.map((frame) => toDataFrame(structuredClone(frame))),
      };
      act(() => {
        session.preview(optionId);
        canonical.setState({ data: fresh });
      });
      expect(screen.getByTestId('canonical-health')).toHaveTextContent(
        JSON.stringify([optionFrames[0].data.values[1]])
      );
      expect(engine.getCanonicalData()?.request?.requestId).toBe('SQR105');
      expect(engine.getCanonicalData()?.series[0].fields[1].values).toEqual(freshFrames[0].data.values[1]);
      expect(session.getState().health).toEqual({ A: 'ok' });
      act(() => {
        session.preview('original');
      });
      expect(screen.getByTestId('canonical-health')).toHaveTextContent(JSON.stringify([freshFrames[0].data.values[1]]));
      expect(engine.getCanonicalData()?.series[0].fields[1].values).toEqual(freshFrames[0].data.values[1]);
      expect(session.getState().health).toEqual({ A: 'ok' });
      expect(session.getState().problems).toEqual([]);
    } finally {
      act(() => engine.dispose());
      unmount();
    }
  }
);
