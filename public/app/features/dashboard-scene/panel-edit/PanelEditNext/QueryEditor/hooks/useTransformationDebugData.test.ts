import { renderHook, waitFor } from '@testing-library/react';
import { Observable } from 'rxjs';

import { type DataFrame, type DataTransformerConfig, transformDataFrame } from '@grafana/data';

import { makeFrames, makeTransformation } from './testUtils';
import { useTransformationDebugData } from './useTransformationDebugData';
import { NO_CONFIGS, type TransformationConfigs } from './useTransformedFrames';

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  transformDataFrame: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({ replace: (v: string) => v }),
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
        systemTransformations: NO_CONFIGS,
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
        systemTransformations: NO_CONFIGS,
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
        systemTransformations: NO_CONFIGS,
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
        systemTransformations: NO_CONFIGS,
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
        systemTransformations: NO_CONFIGS,
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
        systemTransformations: NO_CONFIGS,
        data,
        isActive: false,
      })
    );

    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
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
        systemTransformations: NO_CONFIGS,
        data,
        isActive: true,
      })
    );

    expect(result.current.input.map(({ name }) => name)).toEqual(['joined']);
    // The output is what the transformation produced, which the filter has already been applied to.
    expect(result.current.output.map(({ name }) => name)).toEqual(['joined', 'excluded']);
  });

  it('replays the plugin-registered transformations ahead of the preceding user ones', () => {
    // They run ahead of every user transformation but are absent from the editable list, so replaying
    // that list alone shows an input the debugged transformation never receives. Which configs
    // precede which is `precedingTransformations`' own concern; this only pins that they reach it.
    const systemTransformations = [jest.fn()];
    respondByConfig({});

    renderHook(() =>
      useTransformationDebugData({
        selectedTransformation: transformations[1],
        transformations,
        systemTransformations,
        data,
        isActive: true,
      })
    );

    expect(mockTransformDataFrame).toHaveBeenCalledWith(
      [...systemTransformations, transformations[0].transformConfig],
      data,
      expect.any(Object)
    );
  });
});
