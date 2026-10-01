import { renderHook } from '@testing-library/react';
import { Observable } from 'rxjs';

import { type DataFrame, transformDataFrame } from '@grafana/data';

import { makeFrames, makeTransformation } from './testUtils';
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
        queryData,
      })
    );

    expect(result.current).toEqual(queryData);
    expect(mockTransformDataFrame).not.toHaveBeenCalled();
  });

  it('runs every transformation preceding the selected one', () => {
    const transformations = [
      makeTransformation('joinByField'),
      makeTransformation('organize'),
      makeTransformation('filterByValue'),
    ];

    const { result } = renderHook(() =>
      usePreviousTransformationOutput({
        selectedTransformation: transformations[2],
        transformations,
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

  it('offers nothing for a transformation the pipeline does not contain', () => {
    // A transformation just removed from the list still renders for a frame before its editor closes,
    // and `findIndex` answering -1 for it must not be read as "first in the pipeline".
    const transformations = [makeTransformation('joinByField'), makeTransformation('organize')];

    const { result } = renderHook(() =>
      usePreviousTransformationOutput({
        selectedTransformation: makeTransformation('removed'),
        transformations,
        queryData,
      })
    );

    expect(result.current).toEqual([]);
    expect(mockTransformDataFrame).not.toHaveBeenCalled();
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
        queryData,
      })
    );

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
