import { renderHook } from '@testing-library/react';
import { Observable } from 'rxjs';

import { type DataFrame, transformDataFrame } from '@grafana/data';

import { type Transformation } from '../types';

import { usePreviousTransformationOutput } from './usePreviousTransformationOutput';

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

function makeFrames(names: string[]): DataFrame[] {
  return names.map((name) => ({ name, fields: [], length: 0 }));
}

/** Stable identity: the hook re-runs its effect when any input's identity changes. */
const NO_SYSTEM_TRANSFORMATIONS: [] = [];

describe('usePreviousTransformationOutput', () => {
  const queryData = makeFrames(['A-series', 'B-series']);
  const pipelineOutput = makeFrames(['joined']);

  beforeEach(() => {
    jest.clearAllMocks();

    mockTransformDataFrame.mockReturnValue(
      new Observable((subscriber) => {
        subscriber.next(pipelineOutput);
      })
    );
  });

  it('lists the query frames for the first transformation when nothing precedes it', () => {
    const transformations = [makeTransformation('joinByField'), makeTransformation('organize')];

    const { result } = renderHook(() =>
      usePreviousTransformationOutput({
        selectedTransformation: transformations[0],
        transformations,
        systemTransformations: NO_SYSTEM_TRANSFORMATIONS,
        queryData,
      })
    );

    expect(result.current).toEqual(queryData);
    expect(mockTransformDataFrame).not.toHaveBeenCalled();
  });

  it('runs every user transformation preceding the selected one', () => {
    const transformations = [
      makeTransformation('joinByField'),
      makeTransformation('organize'),
      makeTransformation('filterByValue'),
    ];

    const { result } = renderHook(() =>
      usePreviousTransformationOutput({
        selectedTransformation: transformations[2],
        transformations,
        systemTransformations: NO_SYSTEM_TRANSFORMATIONS,
        queryData,
      })
    );

    expect(mockTransformDataFrame).toHaveBeenCalledWith(
      [transformations[0].transformConfig, transformations[1].transformConfig],
      queryData,
      expect.any(Object)
    );
    expect(mockTransformDataFrame).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual(pipelineOutput);
  });

  it('adds an empty frame for a requested refId the query returned nothing for', () => {
    const transformations = [makeTransformation('joinByField')];
    // Hoisted out of the render callback: every option is an effect dep, so a fresh literal per
    // render would re-run the pipeline and set state forever.
    const returnedFrames: DataFrame[] = [{ refId: 'A', name: 'A-series', fields: [], length: 0 }];
    const queryTargets = [{ refId: 'A' }, { refId: 'B' }];

    const { result } = renderHook(() =>
      usePreviousTransformationOutput({
        selectedTransformation: transformations[0],
        transformations,
        systemTransformations: NO_SYSTEM_TRANSFORMATIONS,
        queryData: returnedFrames,
        queryTargets,
      })
    );

    // B is pickable in the filter even though it returned no data, so a user can filter it out ahead
    // of a refresh that does return some.
    expect(result.current).toEqual([
      { refId: 'A', name: 'A-series', fields: [], length: 0 },
      { refId: 'B', fields: [], length: 0 },
    ]);
  });

  describe('plugin-registered transformations', () => {
    // The filter matcher runs against the frames the pipeline actually produces. These run ahead of
    // every user transformation, so a picker built without them lists frames that no longer exist by
    // the time the filter is applied.
    const systemTransformations = [jest.fn()];

    it('runs them for the first user transformation, which nothing else precedes', () => {
      const transformations = [makeTransformation('joinByField'), makeTransformation('organize')];

      const { result } = renderHook(() =>
        usePreviousTransformationOutput({
          selectedTransformation: transformations[0],
          transformations,
          systemTransformations,
          queryData,
        })
      );

      // The query-result short-circuit must not apply: the plugin's transformations do precede this.
      expect(mockTransformDataFrame).toHaveBeenCalledWith(systemTransformations, queryData, expect.any(Object));
      expect(result.current).toEqual(pipelineOutput);
    });

    it('runs them ahead of the preceding user transformations', () => {
      const transformations = [makeTransformation('joinByField'), makeTransformation('organize')];

      renderHook(() =>
        usePreviousTransformationOutput({
          selectedTransformation: transformations[1],
          transformations,
          systemTransformations,
          queryData,
        })
      );

      expect(mockTransformDataFrame).toHaveBeenCalledWith(
        [...systemTransformations, transformations[0].transformConfig],
        queryData,
        expect.any(Object)
      );
    });
  });

  it('cleans up the subscription when the component unmounts', () => {
    const unsubscribe = jest.fn();
    mockTransformDataFrame.mockReturnValue(
      new Observable((subscriber) => {
        subscriber.next(pipelineOutput);
        return unsubscribe;
      })
    );

    const transformations = [makeTransformation('joinByField'), makeTransformation('organize')];

    const { unmount } = renderHook(() =>
      usePreviousTransformationOutput({
        selectedTransformation: transformations[1],
        transformations,
        systemTransformations: NO_SYSTEM_TRANSFORMATIONS,
        queryData,
      })
    );

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
