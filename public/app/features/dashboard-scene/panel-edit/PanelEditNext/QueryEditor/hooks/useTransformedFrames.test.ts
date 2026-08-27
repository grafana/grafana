import { act, renderHook } from '@testing-library/react';
import { Observable } from 'rxjs';

import { type DataFrame, transformDataFrame } from '@grafana/data';
import { DataTopic } from '@grafana/schema';

import { makeFrames, makeTransformation } from './testUtils';
import {
  NO_CONFIGS,
  type TransformationConfigs,
  precedingTransformations,
  useFrameReplay,
  useTransformedFrames,
} from './useTransformedFrames';

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  transformDataFrame: jest.fn(),
}));

/** Mutable, so a test can move a variable the way the dashboard's variable picker does. */
let envValue = 'prod';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({ replace: (v: string) => v.replace(/\$env/g, envValue) }),
}));

const mockTransformDataFrame = jest.mocked(transformDataFrame);

describe('useTransformedFrames', () => {
  const frames = makeFrames(['a', 'b']);
  const emitted = makeFrames(['transformed']);
  const configs: TransformationConfigs = [{ id: 'organize', options: {} }];
  const withVariable: TransformationConfigs = [{ id: 'filterByValue', options: { value: '$env' } }];

  beforeEach(() => {
    envValue = 'prod';
    jest.clearAllMocks();
    mockTransformDataFrame.mockReturnValue(
      new Observable((subscriber) => {
        subscriber.next(emitted);
      })
    );
  });

  it('returns the frames unchanged and runs nothing when there is nothing to run', () => {
    const { result } = renderHook(() => useTransformedFrames(NO_CONFIGS, frames));

    // Same reference, so a caller using this as an effect dep does not re-run on every render.
    expect(result.current).toBe(frames);
    expect(mockTransformDataFrame).not.toHaveBeenCalled();
  });

  it('returns the new frames without waiting for a subscription when configs are empty', () => {
    const nextFrames = makeFrames(['c']);

    const { result, rerender } = renderHook(
      ({ data }: { data: DataFrame[] }) => useTransformedFrames(NO_CONFIGS, data),
      {
        initialProps: { data: frames },
      }
    );

    act(() => rerender({ data: nextFrames }));

    expect(result.current).toBe(nextFrames);
  });

  it('runs the configs over the frames and returns what they emit', () => {
    const { result } = renderHook(() => useTransformedFrames(configs, frames));

    expect(mockTransformDataFrame).toHaveBeenCalledWith(configs, frames, expect.any(Object));
    expect(mockTransformDataFrame).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(emitted);
  });

  it('resolves variables in transformation options before replaying them', () => {
    // The pipeline interpolates configs before it runs them, and `transformDataFrame` skips its own
    // pass whenever a scene is active — which, in the panel editor, is always. Forwarding the raw
    // config replays a transformation matching on the literal `$env` that the panel never ran.
    renderHook(() => useTransformedFrames(withVariable, frames));

    expect(mockTransformDataFrame).toHaveBeenCalledWith(
      [{ id: 'filterByValue', options: { value: 'prod' } }],
      frames,
      expect.any(Object)
    );
  });

  it('re-resolves and re-runs when a variable moves, though the configs are the same objects', () => {
    // The panel's pipeline reprocesses on a variable change, so the editor has to as well. Nothing
    // it can compare by identity moves: `useTransformations` rebuilds its array around the same
    // Scene state entries, and those still hold the literal `$env`. Only the resolved options move.
    const { rerender } = renderHook(() => useTransformedFrames(withVariable, frames));

    expect(mockTransformDataFrame).toHaveBeenLastCalledWith(
      [{ id: 'filterByValue', options: { value: 'prod' } }],
      frames,
      expect.any(Object)
    );

    envValue = 'staging';
    act(() => rerender());

    expect(mockTransformDataFrame).toHaveBeenLastCalledWith(
      [{ id: 'filterByValue', options: { value: 'staging' } }],
      frames,
      expect.any(Object)
    );
    expect(mockTransformDataFrame).toHaveBeenCalledTimes(2);
  });

  it('holds the previous output across a variable change rather than dropping to the frames', () => {
    // A variable change is the same list of transformations, so what it last produced is still the
    // shape the editors read — the same reason a new query holds rather than falling back.
    const { result, rerender } = renderHook(() => useTransformedFrames(withVariable, frames));

    expect(result.current).toBe(emitted);

    mockTransformDataFrame.mockReturnValue(new Observable(() => {}));
    envValue = 'staging';
    act(() => rerender());

    expect(result.current).toBe(emitted);
  });

  it('does not re-run when the variable resolves to what it did before', () => {
    // Interpolation runs every render now, so an unchanged resolution has to compare equal or the
    // replay resubscribes on every emission the panel makes.
    const { rerender } = renderHook(({ c }: { c: TransformationConfigs }) => useTransformedFrames(c, frames), {
      initialProps: { c: [...withVariable] },
    });

    act(() => rerender({ c: [...withVariable] }));

    expect(mockTransformDataFrame).toHaveBeenCalledTimes(1);
  });

  it('does not re-run when a caller rebuilds an array around the same custom operator', () => {
    // Interpolation leaves operators untouched, so identity is what "unchanged" means for them.
    const operator = jest.fn();

    const { rerender } = renderHook(({ c }: { c: TransformationConfigs }) => useTransformedFrames(c, frames), {
      initialProps: { c: [operator] },
    });

    act(() => rerender({ c: [operator] }));

    expect(mockTransformDataFrame).toHaveBeenCalledTimes(1);
  });

  it('reports a config whose variables cannot be resolved, once, and replays it as written', () => {
    // A variable value can carry characters that do not survive the JSON round trip. Replaying the
    // config as written beats dropping the transformation, but silently doing so is a transformation
    // matching on a literal `$var` with nothing to explain it. Resolving runs every render, so the
    // report has to not repeat itself.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    envValue = '"';
    const withVariable: TransformationConfigs = [{ id: 'filterByValue', options: { value: '$env' } }];

    const { rerender } = renderHook(() => useTransformedFrames(withVariable, frames));
    act(() => rerender());

    expect(mockTransformDataFrame).toHaveBeenLastCalledWith(withVariable, frames, expect.any(Object));
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('filterByValue'), expect.any(Error));

    consoleError.mockRestore();
  });

  it('leaves custom operators alone, as the pipeline does', () => {
    // Their options are captured in a closure, so there is nothing here to resolve.
    const operator = jest.fn();
    const custom: TransformationConfigs = [operator];

    renderHook(() => useTransformedFrames(custom, frames));

    expect(mockTransformDataFrame).toHaveBeenCalledWith([operator], frames, expect.any(Object));
  });

  it('still hands a context to transformers that resolve their own options', () => {
    // `formatTime` reads `ctx.interpolate` itself rather than relying on the pass above.
    renderHook(() => useTransformedFrames(configs, frames));

    const ctx = mockTransformDataFrame.mock.calls[0][2];

    expect(ctx?.interpolate('$env')).toBe('prod');
  });

  it('does not re-run when a caller rebuilds its arrays with the same contents', () => {
    // Callers rebuild these every time the panel emits, because `useTransformations` memoizes on
    // transformer state and that carries `data`. Treating a new array as a new generation would
    // resubscribe on every emission — and, for an array built fresh each render, without end.
    const { rerender } = renderHook(
      ({ c, f }: { c: TransformationConfigs; f: DataFrame[] }) => useTransformedFrames(c, f),
      { initialProps: { c: [...configs], f: [...frames] } }
    );

    act(() => rerender({ c: [...configs], f: [...frames] }));

    expect(mockTransformDataFrame).toHaveBeenCalledTimes(1);
  });

  it('re-runs against the new frames when a query returns', () => {
    const nextFrames = makeFrames(['c']);

    const { rerender } = renderHook(({ data }: { data: DataFrame[] }) => useTransformedFrames(configs, data), {
      initialProps: { data: frames },
    });

    act(() => rerender({ data: nextFrames }));

    expect(mockTransformDataFrame).toHaveBeenLastCalledWith(configs, nextFrames, expect.any(Object));
    expect(mockTransformDataFrame).toHaveBeenCalledTimes(2);
  });

  it('unsubscribes on unmount', () => {
    const unsubscribe = jest.fn();
    mockTransformDataFrame.mockReturnValue(
      new Observable((subscriber) => {
        subscriber.next(emitted);
        return unsubscribe;
      })
    );

    const { unmount } = renderHook(() => useTransformedFrames(configs, frames));

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('holds what this pipeline last produced while the next replay is in flight', () => {
    // The replay lands a render after the frames it belongs to. Falling back to the untransformed
    // frames over that gap shows the pre-pipeline shape, which an editor reports on as though the
    // panel had it — an Organize editor flips to "only works with a single frame" on every refresh.
    const nextFrames = makeFrames(['c']);

    const { result, rerender } = renderHook(({ data }: { data: DataFrame[] }) => useTransformedFrames(configs, data), {
      initialProps: { data: frames },
    });

    expect(result.current).toBe(emitted);

    // A query that has landed but not been transformed yet.
    mockTransformDataFrame.mockReturnValue(new Observable(() => {}));
    act(() => rerender({ data: nextFrames }));

    expect(result.current).toBe(emitted);
    expect(result.current).not.toBe(nextFrames);
  });

  it('drops what it was holding when the pipeline itself changes', () => {
    // A different set of configs is a different shape, so the previous output is not a stand-in for
    // it the way the same pipeline's last output is.
    const otherConfigs: TransformationConfigs = [{ id: 'reduce', options: {} }];

    const { result, rerender } = renderHook(({ c }: { c: TransformationConfigs }) => useTransformedFrames(c, frames), {
      initialProps: { c: configs },
    });

    expect(result.current).toBe(emitted);

    mockTransformDataFrame.mockReturnValue(new Observable(() => {}));
    act(() => rerender({ c: otherConfigs }));

    expect(result.current).toBe(frames);
  });

  describe('when the transformations fail', () => {
    let consoleError: jest.SpyInstance;

    beforeEach(() => {
      consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleError.mockRestore();
    });

    it('falls back to the untransformed frames when the pipeline errors', () => {
      const failure = new Error('extractFields could not parse the column as JSON');
      mockTransformDataFrame.mockReturnValue(
        new Observable((subscriber) => {
          subscriber.error(failure);
        })
      );

      const { result } = renderHook(() => useTransformedFrames(configs, frames));

      expect(result.current).toBe(frames);
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('Failed to replay'), failure);
    });

    it('falls back when a custom operator throws as its pipeline is built', () => {
      // `transformDataFrame` calls operator factories synchronously, before there is an observable
      // to carry the error — so this throws out of the effect and unmounts the pane if uncaught.
      const failure = new Error('operator factory read a missing option');
      mockTransformDataFrame.mockImplementation(() => {
        throw failure;
      });

      const { result } = renderHook(() => useTransformedFrames(configs, frames));

      expect(result.current).toBe(frames);
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('Failed to replay'), failure);
    });

    it('settles on the failure instead of leaving every later render looking unresolved', () => {
      mockTransformDataFrame.mockReturnValue(
        new Observable((subscriber) => {
          subscriber.error(new Error('boom'));
        })
      );

      const { result, rerender } = renderHook(() => useTransformedFrames(configs, frames));

      // A failed generation is recorded, so re-rendering does not re-run the broken pipeline.
      act(() => rerender());

      expect(result.current).toBe(frames);
      expect(mockTransformDataFrame).toHaveBeenCalledTimes(1);
    });
  });
});

describe('useFrameReplay', () => {
  const frames = makeFrames(['a', 'b']);
  const emitted = makeFrames(['transformed']);
  const configs: TransformationConfigs = [{ id: 'organize', options: {} }];

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransformDataFrame.mockReturnValue(
      new Observable((subscriber) => {
        subscriber.next(emitted);
      })
    );
  });

  it('reports what it produced as both what to show and what to pipe onward', () => {
    const { result } = renderHook(() => useFrameReplay(configs, frames));

    expect(result.current.frames).toBe(emitted);
    expect(result.current.settled).toBe(emitted);
  });

  it('settles on the frames themselves when there is no pipeline to run', () => {
    // An empty pipeline produces its input, so a replay piped off it has real frames to run over.
    const { result } = renderHook(() => useFrameReplay(NO_CONFIGS, frames));

    expect(result.current.settled).toBe(frames);
  });

  it('reports nothing settled while a replay is in flight, though it still has frames to show', () => {
    // The distinction the debug drawer's two stages turn on: an editor reads the untransformed
    // frames standing in, but a replay piped off this one must not run over them.
    mockTransformDataFrame.mockReturnValue(new Observable(() => {}));

    const { result } = renderHook(() => useFrameReplay(configs, frames));

    expect(result.current.frames).toBe(frames);
    expect(result.current.settled).toEqual([]);
  });

  it('keeps reporting the held output as settled across a data change', () => {
    // Stale by one query, but a shape this pipeline did produce — so it is safe to pipe onward.
    const nextFrames = makeFrames(['c']);

    const { result, rerender } = renderHook(({ data }: { data: DataFrame[] }) => useFrameReplay(configs, data), {
      initialProps: { data: frames },
    });

    mockTransformDataFrame.mockReturnValue(new Observable(() => {}));
    act(() => rerender({ data: nextFrames }));

    expect(result.current.settled).toBe(emitted);
  });

  it('reports nothing settled when the replay fails, though it still shows the frames', () => {
    // A failure falls back to the untransformed frames, which is the right thing to show and the
    // wrong thing to pipe onward: this pipeline never produced them, so a replay running over them
    // produces a shape the panel never emits.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockTransformDataFrame.mockReturnValue(
      new Observable((subscriber) => {
        subscriber.error(new Error('extractFields could not parse the column as JSON'));
      })
    );

    const { result } = renderHook(() => useFrameReplay(configs, frames));

    expect(result.current.frames).toBe(frames);
    expect(result.current.settled).toEqual([]);

    consoleError.mockRestore();
  });

  it('drops what it settled on when the pipeline itself changes', () => {
    const otherConfigs: TransformationConfigs = [{ id: 'reduce', options: {} }];

    const { result, rerender } = renderHook(({ c }: { c: TransformationConfigs }) => useFrameReplay(c, frames), {
      initialProps: { c: configs },
    });

    mockTransformDataFrame.mockReturnValue(new Observable(() => {}));
    act(() => rerender({ c: otherConfigs }));

    expect(result.current.settled).toEqual([]);
  });
});

describe('precedingTransformations', () => {
  const all = [makeTransformation('joinByField'), makeTransformation('organize'), makeTransformation('reduce')];

  it('returns nothing for the first transformation, which nothing precedes', () => {
    expect(precedingTransformations(all[0], all)).toEqual([]);
  });

  it('returns the transformations ahead of the selected one, in pipeline order', () => {
    expect(precedingTransformations(all[2], all)).toEqual([all[0].transformConfig, all[1].transformConfig]);
  });

  it('treats a transformation missing from the list as first rather than slicing by -1', () => {
    // `slice(0, -1)` would return every entry but the last, so the caller would replay
    // transformations that do not precede anything.
    expect(precedingTransformations(makeTransformation('absent'), all)).toEqual([]);
  });

  it('keeps one identity for "nothing precedes this", so a caller memo does not churn', () => {
    expect(precedingTransformations(all[0], all)).toBe(NO_CONFIGS);
  });

  it('leaves out annotation-topic transformations, which run over a different set of frames', () => {
    // The pipeline routes those to `data.annotations` in a separate pass, so replaying them over the
    // series applies a transformation to frames it never receives.
    const annotations = {
      ...makeTransformation('filterByRefId'),
      transformConfig: { id: 'filterByRefId', options: {}, topic: DataTopic.Annotations },
    };
    const series = makeTransformation('organize');
    const selected = makeTransformation('reduce');

    expect(precedingTransformations(selected, [annotations, series, selected])).toEqual([series.transformConfig]);
  });
});
