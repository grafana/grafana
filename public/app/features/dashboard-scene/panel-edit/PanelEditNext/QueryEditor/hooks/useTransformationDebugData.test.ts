import { renderHook, waitFor } from '@testing-library/react';
import { Observable } from 'rxjs';

import { type DataFrame, type DataTransformerConfig, transformDataFrame } from '@grafana/data';

import { makeFrames, makeTransformation } from './testUtils';
import { useTransformationDebugData } from './useTransformationDebugData';
import { type TransformationConfigs } from './useTransformedFrames';

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  transformDataFrame: jest.fn(),
}));

/** Mutable, so a test can pick what the filter's variable resolves to. */
let envValue = 'keep';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({ replace: (v: string) => v.replace(/\$env/g, envValue) }),
}));

const mockTransformDataFrame = jest.mocked(transformDataFrame);

const emit = (frames: DataFrame[]) => new Observable<DataFrame[]>((subscriber) => subscriber.next(frames));

/** Real `transformDataFrame` resolves a task later; answering synchronously hides every render in between. */
const emitAsync = (frames: DataFrame[]) =>
  new Observable<DataFrame[]>((subscriber) => {
    const timeout = setTimeout(() => subscriber.next(frames), 0);
    return () => clearTimeout(timeout);
  });

const configIds = (configs: TransformationConfigs) =>
  configs.map((config) => (typeof config === 'object' && 'id' in config ? config.id : 'custom')).join(',');

/**
 * Answers by which transformation it was handed, so an assertion can tell the two stages apart. A
 * mock that answers the same frames whatever it receives cannot fail if the stages are swapped.
 */
const respondByConfig = (answers: Record<string, DataFrame[]>) =>
  mockTransformDataFrame.mockImplementation((configs) =>
    emit(answers[configIds(configs)] ?? makeFrames([`unstubbed:${configIds(configs)}`]))
  );

/**
 * Answers with a frame named after what it received, so an assertion can tell which generation of
 * input a stage ran over rather than only which configs it ran.
 */
const respondByInput = () =>
  mockTransformDataFrame.mockImplementation((configs, frames) =>
    emitAsync(makeFrames([`${configIds(configs)}(${frames.map(({ name }) => name).join('+')})`]))
  );

describe('useTransformationDebugData', () => {
  const data = makeFrames(['A-series', 'B-series']);
  const transformations = [makeTransformation('joinByField'), makeTransformation('organize')];

  beforeEach(() => {
    envValue = 'keep';
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockTransformDataFrame.mockReset();
  });

  it('shows the preceding stage as input and that stage piped through the debugged one as output', () => {
    const joined = makeFrames(['joined']);
    const organized = makeFrames(['organized']);
    respondByConfig({ joinByField: joined, organize: organized });

    const { result } = renderHook(() =>
      useTransformationDebugData({
        selectedTransformation: transformations[1],
        transformations,
        data,
        isActive: true,
      })
    );

    // The preceding stage runs over the query result...
    expect(mockTransformDataFrame).toHaveBeenCalledWith([transformations[0].transformConfig], data, expect.any(Object));
    // ...and the debugged one runs over what that produced, rather than replaying the whole pipeline
    // from `data` a second time.
    expect(mockTransformDataFrame).toHaveBeenCalledWith(
      [transformations[1].transformConfig],
      joined,
      expect.any(Object)
    );

    // Distinct frames per stage, so swapping input and output in the hook fails this.
    expect(result.current.input.map(({ name }) => name)).toEqual(['joined']);
    expect(result.current.output.map(({ name }) => name)).toEqual(['organized']);
  });

  it('waits for the preceding stage instead of running the debugged transformation over the query frames', async () => {
    // `transformDataFrame` resolves a task after the render that subscribed to it, so on the render
    // the output stage first runs, the preceding stage has produced nothing and stands in the
    // untransformed frames. Running the debugged transformation over those puts a shape in the
    // output pane that the pipeline never produces, next to an input pane that has already settled.
    respondByInput();
    const shown: string[][] = [];

    const { result } = renderHook(() => {
      const debug = useTransformationDebugData({
        selectedTransformation: transformations[1],
        transformations,
        data,
        isActive: true,
      });
      shown.push(debug.output.map(({ name }) => name ?? ''));
      return debug;
    });

    await waitFor(() =>
      expect(result.current.output.map(({ name }) => name)).toEqual(['organize(joinByField(A-series+B-series))'])
    );

    const debuggedRuns = mockTransformDataFrame.mock.calls.filter(
      ([configs]) => (configs[0] as DataTransformerConfig).id === 'organize'
    );

    // Nothing to run over, then the settled input — never the query frames the input pane stood in.
    expect(debuggedRuns.map(([, frames]) => frames.map(({ name }) => name))).toEqual([
      [],
      ['joinByField(A-series+B-series)'],
    ]);
    expect(shown).not.toContainEqual(['organize(A-series+B-series)']);
  });

  it('does not fall back to running the debugged transformation over the query frames when the preceding stage fails', () => {
    // A failed replay settles on the untransformed frames so the editors have something to read.
    // Piping those into the debugged transformation is the same wrong pairing as piping a stand-in:
    // the panel is showing a data error, and there is no input for this pane to report output for.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockTransformDataFrame.mockImplementation((configs, frames) =>
      configIds(configs) === 'joinByField'
        ? new Observable<DataFrame[]>((subscriber) => subscriber.error(new Error('joinByField blew up')))
        : emit(makeFrames([`organize(${frames.map(({ name }) => name).join('+')})`]))
    );

    renderHook(() =>
      useTransformationDebugData({
        selectedTransformation: transformations[1],
        transformations,
        data,
        isActive: true,
      })
    );

    const debuggedRuns = mockTransformDataFrame.mock.calls.filter(
      ([configs]) => (configs[0] as DataTransformerConfig).id === 'organize'
    );

    expect(debuggedRuns.map(([, frames]) => frames.map(({ name }) => name))).toEqual([[]]);

    consoleError.mockRestore();
  });

  it('runs the preceding stage once, not once per pane', () => {
    respondByConfig({ joinByField: makeFrames(['joined']), organize: makeFrames(['organized']) });

    renderHook(() =>
      useTransformationDebugData({
        selectedTransformation: transformations[1],
        transformations,
        data,
        isActive: true,
      })
    );

    const precedingRuns = mockTransformDataFrame.mock.calls.filter(
      ([configs]) => configs.length === 1 && (configs[0] as DataTransformerConfig).id === 'joinByField'
    );
    expect(precedingRuns).toHaveLength(1);
  });

  it('produces nothing while the debug drawer is closed', () => {
    respondByConfig({});

    const { result } = renderHook(() =>
      useTransformationDebugData({
        selectedTransformation: transformations[1],
        transformations,
        data,
        isActive: false,
      })
    );

    expect(mockTransformDataFrame).not.toHaveBeenCalled();
    expect(result.current).toEqual({ input: [], output: [] });
  });

  it('keeps one identity for "nothing to show", so a closed drawer does not re-render its readers', () => {
    respondByConfig({});

    const { result, rerender } = renderHook(() =>
      useTransformationDebugData({
        selectedTransformation: transformations[1],
        transformations,
        data,
        isActive: false,
      })
    );

    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
  });

  it('admits frames by the filter as the pipeline resolved it, not by the literal variable', () => {
    // The filter runs ahead of the transformation, and the pipeline interpolates it along with the
    // rest of the config — so the replay does too. A matcher built from the raw config narrows the
    // displayed input by a `$var` that never reached `transformDataFrame`, hiding frames the
    // transformation was handed.
    const filteredTransformation = {
      ...transformations[1],
      transformConfig: { id: 'organize', options: {}, filter: { id: 'byName', options: '$env' } },
    };

    respondByConfig({ joinByField: makeFrames(['keep', 'drop']), organize: makeFrames(['organized']) });

    const { result } = renderHook(() =>
      useTransformationDebugData({
        selectedTransformation: filteredTransformation,
        transformations: [transformations[0], filteredTransformation],
        data,
        isActive: true,
      })
    );

    expect(result.current.input.map(({ name }) => name)).toEqual(['keep']);
  });

  it('shows the input unnarrowed when the resolved filter cannot be built into a matcher', () => {
    // `byName` runs its option through `stringToJsRegex`, which throws on a `/`-prefixed string that
    // is not a complete `/pattern/flags` — a variable resolving to a path is enough. The pipeline's
    // own call to `getFrameMatchers` sits behind the replay's error handling, but this one runs
    // during render, where a throw reaches the error boundary and takes the drawer with it.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    envValue = '/var/log';

    const filteredTransformation = {
      ...transformations[1],
      transformConfig: { id: 'organize', options: {}, filter: { id: 'byName', options: '$env' } },
    };

    respondByConfig({ joinByField: makeFrames(['keep', 'drop']), organize: makeFrames(['organized']) });

    const { result } = renderHook(() =>
      useTransformationDebugData({
        selectedTransformation: filteredTransformation,
        transformations: [transformations[0], filteredTransformation],
        data,
        isActive: true,
      })
    );

    expect(result.current.input.map(({ name }) => name)).toEqual(['keep', 'drop']);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('filter'), expect.any(Error));

    consoleError.mockRestore();
  });

  it('admits only the frames the debugged transformation’s own filter matches', () => {
    // The debug view claims to show what the transformation received. Its filter runs ahead of it in
    // the real pipeline, so unfiltered input here shows frames it never saw.
    const filteredTransformation = {
      ...transformations[1],
      transformConfig: { id: 'organize', options: {}, filter: { id: 'byName', options: 'joined' } },
    };
    const filtered = [transformations[0], filteredTransformation];

    respondByConfig({
      joinByField: makeFrames(['joined', 'excluded']),
      organize: makeFrames(['joined', 'excluded']),
    });

    const { result } = renderHook(() =>
      useTransformationDebugData({
        selectedTransformation: filteredTransformation,
        transformations: filtered,
        data,
        isActive: true,
      })
    );

    expect(result.current.input.map(({ name }) => name)).toEqual(['joined']);
    // The output is what the transformation produced, which the filter has already been applied to.
    expect(result.current.output.map(({ name }) => name)).toEqual(['joined', 'excluded']);
  });
});
