import { renderHook } from '@testing-library/react';
import { Observable } from 'rxjs';

import { type DataFrame, transformDataFrame } from '@grafana/data';

import { type Transformation } from '../types';

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

/** Stable identity: the hook re-runs its effect when any input's identity changes. */
const NO_SYSTEM_TRANSFORMATIONS: [] = [];

function makeTransformation(id: string): Transformation {
  return {
    transformId: id,
    transformConfig: { id, options: {} },
    registryItem: undefined,
  };
}

function makeFrames(count: number): DataFrame[] {
  return Array.from({ length: count }, (_, i) => ({ name: `frame-${i}`, fields: [], length: 0 }));
}

describe('useTransformationDebugData', () => {
  const data = makeFrames(2);
  const pipelineOutput = makeFrames(1);
  const transformations = [makeTransformation('joinByField'), makeTransformation('organize')];

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransformDataFrame.mockReturnValue(
      new Observable((subscriber) => {
        subscriber.next(pipelineOutput);
      })
    );
  });

  it('replays the transformations preceding the debugged one', () => {
    const { result } = renderHook(() =>
      useTransformationDebugData({
        selectedTransformation: transformations[1],
        transformations,
        systemTransformations: NO_SYSTEM_TRANSFORMATIONS,
        data,
        isActive: true,
      })
    );

    expect(mockTransformDataFrame).toHaveBeenCalledWith([transformations[0].transformConfig], data, expect.any(Object));
    expect(result.current.input).toBe(pipelineOutput);
    expect(result.current.output).toBe(pipelineOutput);
  });

  it('produces nothing while the debug drawer is closed', () => {
    const { result } = renderHook(() =>
      useTransformationDebugData({
        selectedTransformation: transformations[1],
        transformations,
        systemTransformations: NO_SYSTEM_TRANSFORMATIONS,
        data,
        isActive: false,
      })
    );

    expect(mockTransformDataFrame).not.toHaveBeenCalled();
    expect(result.current).toEqual({ input: [], output: [] });
  });

  describe('plugin-registered transformations', () => {
    // They run ahead of every user transformation but are absent from the editable list, so replaying
    // that list alone shows an input the debugged transformation never receives.
    const systemTransformations = [jest.fn()];

    it('replays them ahead of the preceding user transformations', () => {
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

    it('replays them for the first user transformation, which has no user predecessors', () => {
      renderHook(() =>
        useTransformationDebugData({
          selectedTransformation: transformations[0],
          transformations,
          systemTransformations,
          data,
          isActive: true,
        })
      );

      expect(mockTransformDataFrame).toHaveBeenCalledWith(systemTransformations, data, expect.any(Object));
    });
  });
});
