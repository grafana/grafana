import { act, renderHook } from '@testing-library/react';
import { Observable } from 'rxjs';

import { type DataFrame, transformDataFrame } from '@grafana/data';

import { makeFrames, makeTransformation } from './testUtils';
import {
  NO_CONFIGS,
  type TransformationConfigs,
  precedingTransformations,
  useTransformedFrames,
} from './useTransformedFrames';

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  transformDataFrame: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({ replace: (v: string) => `replaced:${v}` }),
}));

const mockTransformDataFrame = jest.mocked(transformDataFrame);

describe('useTransformedFrames', () => {
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

  it('interpolates transformation options through the template service', () => {
    renderHook(() => useTransformedFrames(configs, frames));

    const ctx = mockTransformDataFrame.mock.calls[0][2];

    expect(ctx?.interpolate('$var')).toBe('replaced:$var');
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

  it('returns the new frames rather than the previous output while a transform is in flight', () => {
    const nextFrames = makeFrames(['c']);

    const { result, rerender } = renderHook(({ data }: { data: DataFrame[] }) => useTransformedFrames(configs, data), {
      initialProps: { data: frames },
    });

    expect(result.current).toBe(emitted);

    // A query that has landed but not been transformed yet.
    mockTransformDataFrame.mockReturnValue(new Observable(() => {}));
    act(() => rerender({ data: nextFrames }));

    // Not `emitted`: those frames came out of the previous query, and a caller pairing them with
    // this query's metadata configures its editors against a shape that never existed.
    expect(result.current).toBe(nextFrames);
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
  });
});

describe('precedingTransformations', () => {
  const all = [makeTransformation('joinByField'), makeTransformation('organize'), makeTransformation('reduce')];
  const system: TransformationConfigs = [jest.fn()];

  it('returns only the plugin transformations for the first one, which nothing else precedes', () => {
    expect(precedingTransformations(all[0], all, system)).toEqual(system);
  });

  it('puts the plugin transformations ahead of the preceding user ones', () => {
    expect(precedingTransformations(all[2], all, system)).toEqual([
      ...system,
      all[0].transformConfig,
      all[1].transformConfig,
    ]);
  });

  it('treats a transformation missing from the list as first rather than slicing by -1', () => {
    // `slice(0, -1)` would return every entry but the last, so the caller would replay
    // transformations that do not precede anything.
    expect(precedingTransformations(makeTransformation('absent'), all, system)).toEqual(system);
  });
});
