import { renderHook } from '@testing-library/react';
import { Observable } from 'rxjs';

import { transformDataFrame } from '@grafana/data';

import { makeFrames, makeTransformation } from './testUtils';
import { useTransformationDebugData } from './useTransformationDebugData';

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  transformDataFrame: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({ replace: (v: string) => v }),
}));

const mockTransformDataFrame = jest.mocked(transformDataFrame);

describe('useTransformationDebugData', () => {
  const data = makeFrames(['A-series', 'B-series']);
  const pipelineOutput = makeFrames(['joined']);
  const transformations = [makeTransformation('joinByField'), makeTransformation('organize')];

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransformDataFrame.mockReturnValue(
      new Observable((subscriber) => {
        subscriber.next(pipelineOutput);
      })
    );
  });

  it('replays the transformations preceding the debugged one, then the debugged one itself', () => {
    const { result } = renderHook(() =>
      useTransformationDebugData({
        selectedTransformation: transformations[1],
        transformations,
        data,
        isActive: true,
      })
    );

    expect(mockTransformDataFrame).toHaveBeenCalledWith([transformations[0].transformConfig], data, expect.any(Object));
    // The output stage is its own list rather than a second pass over the input's result, so it has
    // to be asserted separately: the mock answers the same frames whatever it is handed.
    expect(mockTransformDataFrame).toHaveBeenCalledWith(
      [transformations[0].transformConfig, transformations[1].transformConfig],
      data,
      expect.any(Object)
    );
    expect(result.current.input).toBe(pipelineOutput);
    expect(result.current.output).toBe(pipelineOutput);
  });

  it('produces nothing while the debug drawer is closed', () => {
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

  it('admits only the frames the debugged transformation’s own filter matches', () => {
    // The debug view claims to show what the transformation received. Its filter runs ahead of it in
    // the real pipeline, so unfiltered input here shows frames it never saw.
    const filteredTransformation = {
      ...transformations[1],
      transformConfig: { id: 'organize', options: {}, filter: { id: 'byName', options: 'joined' } },
    };
    const filtered = [transformations[0], filteredTransformation];

    mockTransformDataFrame.mockReturnValue(
      new Observable((subscriber) => {
        subscriber.next(makeFrames(['joined', 'excluded']));
      })
    );

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
