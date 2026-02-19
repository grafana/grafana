import { act, renderHook } from '@testing-library/react';
import { Observable } from 'rxjs';

import { DataFrame, transformDataFrame } from '@grafana/data';

import { Transformation } from '../types';

import { useTransformationInputData } from './useTransformationInputData';

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  transformDataFrame: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({ replace: (v: string) => v }),
}));

const mockTransformDataFrame = jest.mocked(transformDataFrame);

function makeTransformation(id: string): Transformation {
  return {
    transformId: id,
    transformConfig: { id, options: {} },
    registryItem: undefined,
  };
}

function makeFrames(count: number): DataFrame[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `frame-${i}`,
    fields: [],
    length: 0,
  }));
}

describe('useTransformationInputData', () => {
  const rawData = makeFrames(2);
  const mockPipelineOutput = makeFrames(1);

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
    const newRawData = makeFrames(3); // fresh query results

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
