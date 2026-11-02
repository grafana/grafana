import { renderHook } from '@testing-library/react';

import { type DataTransformerConfig } from '@grafana/data';
import { SceneDataTransformer } from '@grafana/scenes';

import { useTransformations } from './useTransformations';

describe('useTransformations', () => {
  it('lists a transformation with a static refId alongside the unnamed ones', () => {
    const named: DataTransformerConfig = { id: 'reduce', refId: 'T-A', options: {} };
    const unnamed: DataTransformerConfig = { id: 'groupBy', options: {} };
    const transformer = new SceneDataTransformer({ transformations: [named, unnamed] });

    const { result } = renderHook(() => useTransformations(transformer));

    expect(result.current.map(({ transformId, transformConfig }) => [transformId, transformConfig])).toEqual([
      ['reduce-0', named],
      ['groupBy-1', unnamed],
    ]);
  });
});
