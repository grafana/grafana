import { getDefaultTimeRange, LoadingState, type PanelData } from '@grafana/data';
import { SceneDataTransformer, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';

import { startQueryPreview } from './queryPreview';

const queryA: DataQuery = { refId: 'A' };
const queryB: DataQuery = { refId: 'B' };
const proposedQuery: DataQuery = { refId: 'A', hide: true };

describe('startQueryPreview', () => {
  beforeEach(() => {
    jest.spyOn(SceneQueryRunner.prototype, 'runQueries').mockImplementation();
    jest.spyOn(SceneQueryRunner.prototype, 'cancelQuery').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs the proposal through a temporary runner without changing canonical queries', () => {
    const queryRunner = new SceneQueryRunner({ queries: [queryA, queryB] });
    const panel = new VizPanel({ key: 'panel-1', $data: queryRunner });

    const preview = startQueryPreview(panel, 'A', proposedQuery);
    const previewRunner = panel.state.$behaviors?.find(
      (behavior): behavior is SceneQueryRunner => behavior instanceof SceneQueryRunner
    );

    expect(preview).toBeDefined();
    expect(queryRunner.state.queries).toEqual([queryA, queryB]);
    expect(previewRunner?.state.queries).toEqual([proposedQuery, queryB]);
    expect(previewRunner?.state.runQueriesMode).toBe('manual');
    expect(previewRunner?.parent).toBe(panel);
    expect(queryRunner.cancelQuery).toHaveBeenCalledTimes(1);
    expect(previewRunner?.runQueries).toHaveBeenCalledTimes(1);
  });

  it('finds a query runner through nested data transformers', () => {
    const queryRunner = new SceneQueryRunner({ queries: [queryA] });
    const panel = new VizPanel({
      key: 'panel-1',
      $data: new SceneDataTransformer({
        $data: new SceneDataTransformer({ $data: queryRunner, transformations: [] }),
        transformations: [],
      }),
    });

    const preview = startQueryPreview(panel, 'A', proposedQuery);
    const previewRunner = panel.state.$behaviors?.find(
      (behavior): behavior is SceneQueryRunner => behavior instanceof SceneQueryRunner
    );

    expect(preview).toBeDefined();
    expect(previewRunner?.state.queries).toEqual([proposedQuery]);

    preview?.dispose();
  });

  it('projects preview data and detaches the temporary runner on dispose', () => {
    const queryRunner = new SceneQueryRunner({ queries: [queryA, queryB] });
    const panel = new VizPanel({ key: 'panel-1', $data: queryRunner });
    const baselineData: PanelData = { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() };
    queryRunner.setState({ data: baselineData });
    const preview = startQueryPreview(panel, 'A', proposedQuery)!;
    const previewRunner = panel.state.$behaviors?.find(
      (behavior): behavior is SceneQueryRunner => behavior instanceof SceneQueryRunner
    )!;
    const previewData: PanelData = { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() };
    const previewStateListener = jest.fn();

    preview.subscribeToState(previewStateListener);

    previewRunner.setState({ data: previewData });

    expect(queryRunner.state.data).toBe(previewData);
    expect(previewStateListener).toHaveBeenCalledWith(LoadingState.Done);

    const cancelCallsBeforeDispose = jest.mocked(previewRunner.cancelQuery).mock.calls.length;
    preview.dispose();
    preview.dispose();

    expect(panel.state.$behaviors).not.toContain(previewRunner);
    expect(previewRunner.parent).toBeUndefined();
    expect(queryRunner.state.data).toBe(baselineData);
    expect(previewRunner.cancelQuery).toHaveBeenCalledTimes(cancelCallsBeforeDispose + 1);
  });

  it('replays preview state when data arrives before subscription', () => {
    const queryRunner = new SceneQueryRunner({ queries: [queryA] });
    const panel = new VizPanel({ key: 'panel-1', $data: queryRunner });
    const preview = startQueryPreview(panel, 'A', proposedQuery)!;
    const previewRunner = panel.state.$behaviors?.find(
      (behavior): behavior is SceneQueryRunner => behavior instanceof SceneQueryRunner
    )!;
    const previewData: PanelData = { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() };
    const previewStateListener = jest.fn();

    previewRunner.setState({ data: previewData });
    preview.subscribeToState(previewStateListener);

    expect(previewStateListener).toHaveBeenCalledWith(LoadingState.Done);
  });

  it('disposes before a canonical query change can run and preserves the newer result', () => {
    const queryRunner = new SceneQueryRunner({ queries: [queryA, queryB] });
    const panel = new VizPanel({ key: 'panel-1', $data: queryRunner });
    const baselineData: PanelData = { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() };
    const previewData: PanelData = { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() };
    const canonicalData: PanelData = { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() };
    queryRunner.setState({ data: baselineData });
    const preview = startQueryPreview(panel, 'A', proposedQuery)!;
    const previewRunner = panel.state.$behaviors?.find(
      (behavior): behavior is SceneQueryRunner => behavior instanceof SceneQueryRunner
    )!;

    previewRunner.setState({ data: previewData });
    expect(queryRunner.state.data).toBe(previewData);

    queryRunner.setState({ queries: [{ ...queryA, hide: true }, queryB] });
    queryRunner.setState({ data: canonicalData });
    preview.dispose();
    previewRunner.setState({ data: previewData });

    expect(panel.state.$behaviors).not.toContain(previewRunner);
    expect(queryRunner.state.data).toBe(canonicalData);
  });

  it('keeps the preview when the canonical query is replaced by an equal clone', () => {
    const queryRunner = new SceneQueryRunner({ queries: [queryA, queryB] });
    const panel = new VizPanel({ key: 'panel-1', $data: queryRunner });
    const preview = startQueryPreview(panel, 'A', proposedQuery)!;
    const previewRunner = panel.state.$behaviors?.find(
      (behavior): behavior is SceneQueryRunner => behavior instanceof SceneQueryRunner
    )!;

    queryRunner.setState({ queries: [{ ...queryA }, queryB] });

    expect(panel.state.$behaviors).toContain(previewRunner);
    expect(previewRunner.parent).toBe(panel);
    preview.dispose();
  });

  it('disposes when a sibling canonical query changes', () => {
    const queryRunner = new SceneQueryRunner({ queries: [queryA, queryB] });
    const panel = new VizPanel({ key: 'panel-1', $data: queryRunner });
    startQueryPreview(panel, 'A', proposedQuery)!;
    const previewRunner = panel.state.$behaviors?.find(
      (behavior): behavior is SceneQueryRunner => behavior instanceof SceneQueryRunner
    )!;

    queryRunner.setState({ queries: [queryA, { ...queryB, hide: true }] });

    expect(panel.state.$behaviors).not.toContain(previewRunner);
    expect(previewRunner.parent).toBeUndefined();
  });

  it('rejects a proposal for a query outside the canonical runner', () => {
    const queryRunner = new SceneQueryRunner({ queries: [queryA] });
    const panel = new VizPanel({ key: 'panel-1', $data: queryRunner });

    expect(startQueryPreview(panel, 'B', proposedQuery)).toBeUndefined();
    expect(panel.state.$behaviors).toBeUndefined();
    expect(queryRunner.cancelQuery).not.toHaveBeenCalled();
  });
});
