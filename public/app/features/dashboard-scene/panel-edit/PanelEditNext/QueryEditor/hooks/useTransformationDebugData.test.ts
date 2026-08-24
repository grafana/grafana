import { renderHook } from '@testing-library/react';
import { Observable } from 'rxjs';

import { transformDataFrame } from '@grafana/data';

import { makeFrames, makeTransformation } from './testUtils';
import { useTransformationDebugData } from './useTransformationDebugData';
import { NO_CONFIGS } from './useTransformedFrames';

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
        systemTransformations: NO_CONFIGS,
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
        systemTransformations: NO_CONFIGS,
        data,
        isActive: false,
      })
    );

    expect(mockTransformDataFrame).not.toHaveBeenCalled();
    expect(result.current).toEqual({ input: [], output: [] });
  });

  it('replays the plugin-registered transformations ahead of the preceding user ones', () => {
    // They run ahead of every user transformation but are absent from the editable list, so replaying
    // that list alone shows an input the debugged transformation never receives. Which configs
    // precede which is `precedingTransformations`' own concern; this only pins that they reach it.
    const systemTransformations = [jest.fn()];

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
