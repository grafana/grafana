import { act, renderHook } from '@testing-library/react';
import { Observable } from 'rxjs';

import { type DataFrame, FrameMatcherID, transformDataFrame } from '@grafana/data';

import { type Transformation } from '../types';

import { makeFrames, makeTransformation } from './testUtils';
import { useTransformationInputData } from './useTransformationInputData';

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  transformDataFrame: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  // `$pickedRefId` resolves to `B`, so a test can tell a filter matched on the resolved value apart
  // from one that matched on the literal.
  getTemplateSrv: () => ({ replace: (v: string) => v.replace(/\$pickedRefId/g, 'B') }),
}));

const mockTransformDataFrame = jest.mocked(transformDataFrame);

describe('useTransformationInputData', () => {
  const rawData = makeFrames(['A-series', 'B-series']);
  const mockPipelineOutput = makeFrames(['joined']);

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock: emit mockPipelineOutput synchronously
    mockTransformDataFrame.mockReturnValue(
      new Observable((subscriber) => {
        subscriber.next(mockPipelineOutput);
      })
    );
  });

  it('passes rawData directly when the first transformation is selected — nothing precedes it in the pipeline', () => {
    // Pipeline: [joinByField, organize] — joinByField is selected (index 0)
    // There's nothing before it, so the editor should receive the raw query data unchanged.
    const transformations = [makeTransformation('joinByField'), makeTransformation('organize')];

    const { result } = renderHook(() =>
      useTransformationInputData({
        selectedTransformation: transformations[0],
        allTransformations: transformations,
        rawData,
      })
    );

    // Raw data should pass through untouched — no pipeline computation needed.
    expect(result.current).toBe(rawData);
    // Sanity check: we shouldn't be calling transformDataFrame at all when there's nothing to run.
    expect(mockTransformDataFrame).not.toHaveBeenCalled();
  });

  it('runs preceding transformations when selected transformation is not the first', () => {
    // Pipeline: [joinByField, organize] — organize is selected (index 1).
    const transformations = [makeTransformation('joinByField'), makeTransformation('organize')];

    const { result } = renderHook(() =>
      useTransformationInputData({
        selectedTransformation: transformations[1],
        allTransformations: transformations,
        rawData,
      })
    );

    // The key assertion: only joinByField's config should be passed to transformDataFrame,
    // applied to the raw query data. This proves we correctly sliced "everything before organize".
    expect(mockTransformDataFrame).toHaveBeenCalledWith(
      [transformations[0].transformConfig],
      rawData,
      expect.any(Object)
    );
    // Pipeline should only run once — guards against effect firing multiple times due to bad deps.
    expect(mockTransformDataFrame).toHaveBeenCalledTimes(1);
    // The hook should return whatever transformDataFrame emitted — the transformed frames.
    expect(result.current).toBe(mockPipelineOutput);
  });

  it('runs all preceding transformations for a transformation deep in the pipeline', () => {
    // Pipeline: [joinByField, organize, filterByValue] — filterByValue is selected (index 2).
    // Both joinByField AND organize must run first to produce the correct input.
    // This test proves the slice grows correctly with pipeline depth.
    const transformations = [
      makeTransformation('joinByField'),
      makeTransformation('organize'),
      makeTransformation('filterByValue'),
    ];

    const { result } = renderHook(() =>
      useTransformationInputData({
        selectedTransformation: transformations[2],
        allTransformations: transformations,
        rawData,
      })
    );

    // Both configs before filterByValue must be passed — order matters.
    expect(mockTransformDataFrame).toHaveBeenCalledWith(
      [transformations[0].transformConfig, transformations[1].transformConfig],
      rawData,
      expect.any(Object)
    );
    // Pipeline should only run once — guards against effect firing multiple times due to bad deps.
    expect(mockTransformDataFrame).toHaveBeenCalledTimes(1);
    // Output should be whatever the pipeline emitted.
    expect(result.current).toBe(mockPipelineOutput);
  });

  it('recomputes with the correct preceding configs when the selected transformation changes', () => {
    // Simulates the user switching from the first transformation to the second.
    // When joinByField is selected, nothing precedes it — no pipeline runs.
    // When organize is selected, joinByField must run first to compute its input.
    const transformations = [makeTransformation('joinByField'), makeTransformation('organize')];

    const { result, rerender } = renderHook(
      ({ selected }: { selected: Transformation }) =>
        useTransformationInputData({
          selectedTransformation: selected,
          allTransformations: transformations,
          rawData,
        }),
      { initialProps: { selected: transformations[0] } }
    );

    // First transformation selected — nothing to run.
    expect(result.current).toBe(rawData);
    expect(mockTransformDataFrame).not.toHaveBeenCalled();

    act(() => rerender({ selected: transformations[1] }));

    // Now organize is selected — joinByField must have run first with the raw data.
    expect(mockTransformDataFrame).toHaveBeenCalledWith(
      [transformations[0].transformConfig],
      rawData,
      expect.any(Object)
    );
    expect(result.current).toBe(mockPipelineOutput);
  });

  it('reruns the pipeline against the new data when rawData changes', () => {
    // Simulates a query refreshing — new frames arrive and the preceding transformations
    // must re-run against the fresh data to keep the editor input up to date.
    const transformations = [makeTransformation('joinByField'), makeTransformation('organize')];
    const newRawData = makeFrames(['A-series', 'B-series', 'C-series']); // fresh query results

    const { rerender } = renderHook(
      ({ data }: { data: DataFrame[] }) =>
        useTransformationInputData({
          selectedTransformation: transformations[1],
          allTransformations: transformations,
          rawData: data,
        }),
      { initialProps: { data: rawData } }
    );

    // Initial run — pipeline ran against original rawData.
    expect(mockTransformDataFrame).toHaveBeenLastCalledWith(
      [transformations[0].transformConfig],
      rawData,
      expect.any(Object)
    );

    act(() => rerender({ data: newRawData }));

    // After data changes — pipeline must rerun against the new frames, not the old ones.
    expect(mockTransformDataFrame).toHaveBeenLastCalledWith(
      [transformations[0].transformConfig],
      newRawData,
      expect.any(Object)
    );
  });

  it('never hands the editor untransformed frames once the pipeline has produced something', () => {
    // The replay resolves a render later than the query it belongs to, so there is always a render
    // where the new frames are in and their transformed form is not. Handing the editor the raw
    // frames there gives it the pre-pipeline shape — the Organize editor reads `input.length > 1`
    // and reports "only works with a single frame" on a panel whose Join already merged them.
    const transformations = [makeTransformation('joinByField'), makeTransformation('organize')];
    const newRawData = makeFrames(['C-series']);

    const { result, rerender } = renderHook(
      ({ data }: { data: DataFrame[] }) =>
        useTransformationInputData({
          selectedTransformation: transformations[1],
          allTransformations: transformations,
          rawData: data,
        }),
      { initialProps: { data: rawData } }
    );

    expect(result.current).toBe(mockPipelineOutput);

    // The new query has landed but its replay has not emitted yet.
    mockTransformDataFrame.mockReturnValue(new Observable(() => {}));
    act(() => rerender({ data: newRawData }));

    // The joined frame this pipeline last produced, not the two unjoined ones it never emits.
    expect(result.current).toBe(mockPipelineOutput);
    expect(result.current).not.toBe(newRawData);
  });

  describe('the selected transformation own frame filter', () => {
    // `transformDataFrame` narrows to these itself before running the transformation and merges the
    // rest back afterwards, so the editor has to be shown the same narrowed set. Otherwise an
    // Organize editor behind a filter picking one frame still reports on every frame in the panel.
    const framesByRefId: DataFrame[] = [
      { refId: 'A', name: 'A-series', fields: [], length: 0 },
      { refId: 'B', name: 'B-series', fields: [], length: 0 },
    ];

    it('narrows the raw data when nothing precedes the filtered transformation', () => {
      const transformations = [makeTransformation('organize', { id: FrameMatcherID.byRefId, options: 'B' })];

      const { result } = renderHook(() =>
        useTransformationInputData({
          selectedTransformation: transformations[0],
          allTransformations: transformations,
          rawData: framesByRefId,
        })
      );

      expect(result.current).toEqual([framesByRefId[1]]);
      expect(mockTransformDataFrame).not.toHaveBeenCalled();
    });

    it('narrows what the preceding transformations produced', () => {
      const transformations = [
        makeTransformation('merge'),
        makeTransformation('organize', { id: FrameMatcherID.byRefId, options: 'A' }),
      ];
      mockTransformDataFrame.mockReturnValue(
        new Observable((subscriber) => {
          subscriber.next(framesByRefId);
        })
      );

      const { result } = renderHook(() =>
        useTransformationInputData({
          selectedTransformation: transformations[1],
          allTransformations: transformations,
          rawData,
        })
      );

      // Narrowed after the preceding stage ran, not before it: the filter applies to that stage's
      // output, which is what the pipeline hands the transformation.
      expect(mockTransformDataFrame).toHaveBeenCalledWith(
        [transformations[0].transformConfig],
        rawData,
        expect.any(Object)
      );
      expect(result.current).toEqual([framesByRefId[0]]);
    });

    it('narrows by the resolved value of a filter written as a variable', () => {
      const transformations = [makeTransformation('organize', { id: FrameMatcherID.byRefId, options: '$pickedRefId' })];

      const { result } = renderHook(() =>
        useTransformationInputData({
          selectedTransformation: transformations[0],
          allTransformations: transformations,
          rawData: framesByRefId,
        })
      );

      // `B`, the value the pipeline matched on — not the literal `$pickedRefId`, which matches nothing.
      expect(result.current).toEqual([framesByRefId[1]]);
    });

    it('leaves the frames unnarrowed when the filter cannot be built into a matcher', () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      // `byName` runs its option through `stringToJsRegex`, which throws on a `/`-prefixed string
      // that is not a complete `/pattern/flags`.
      const transformations = [makeTransformation('organize', { id: FrameMatcherID.byName, options: '/etc/hosts' })];

      const { result } = renderHook(() =>
        useTransformationInputData({
          selectedTransformation: transformations[0],
          allTransformations: transformations,
          rawData: framesByRefId,
        })
      );

      expect(result.current).toBe(framesByRefId);
    });

    it('passes the frames through untouched when the transformation has no filter', () => {
      const transformations = [makeTransformation('organize')];

      const { result } = renderHook(() =>
        useTransformationInputData({
          selectedTransformation: transformations[0],
          allTransformations: transformations,
          rawData: framesByRefId,
        })
      );

      // Same reference, so an editor memoizing on its input does not rerun for an unfiltered pipeline.
      expect(result.current).toBe(framesByRefId);
    });
  });

  it('cleans up the subscription when the component unmounts', () => {
    // Without cleanup, a stale subscription could call setState on an unmounted component,
    // causing React warnings and potential bugs if new query data arrives after navigation.
    const unsubscribe = jest.fn();
    mockTransformDataFrame.mockReturnValue(
      new Observable((subscriber) => {
        subscriber.next(mockPipelineOutput);
        // Returning a function from the Observable subscriber is the RxJS teardown mechanism —
        // it gets called when the subscription is unsubscribed.
        return unsubscribe;
      })
    );

    const transformations = [makeTransformation('joinByField'), makeTransformation('organize')];

    const { unmount } = renderHook(() =>
      useTransformationInputData({
        selectedTransformation: transformations[1],
        allTransformations: transformations,
        rawData,
      })
    );

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
