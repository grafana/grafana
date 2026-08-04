import { SceneDataTransformer, SceneQueryRunner } from '@grafana/scenes';

import { PanelPluginDataTransformer } from '../scene/PanelPluginDataTransformer';

import { getUntransformedDataProvider } from './getUntransformedDataProvider';

describe('getUntransformedDataProvider', () => {
  it('returns undefined when there is no provider', () => {
    expect(getUntransformedDataProvider(undefined)).toBeUndefined();
  });

  it('returns a bare query runner untouched', () => {
    const runner = new SceneQueryRunner({ queries: [{ refId: 'A' }] });

    // Compared as a boolean: scene objects hold circular references, so a failing `toBe`
    // diff cannot be serialized by the jest reporter.
    expect(getUntransformedDataProvider(runner) === runner).toBe(true);
  });

  it('unwraps a single transformer level', () => {
    const runner = new SceneQueryRunner({ queries: [{ refId: 'A' }] });
    const transformer = new SceneDataTransformer({ $data: runner, transformations: [] });

    expect(getUntransformedDataProvider(transformer) === runner).toBe(true);
  });

  it('unwraps through a nested panel-plugin transformer to the runner', () => {
    const runner = new SceneQueryRunner({ queries: [{ refId: 'A' }] });
    const userTransformer = new SceneDataTransformer({
      $data: new PanelPluginDataTransformer({ $data: runner, transformations: [] }),
      transformations: [],
    });

    expect(getUntransformedDataProvider(userTransformer) === runner).toBe(true);
  });

  it('stops at a transformer without its own $data', () => {
    // Scenes allows a transformer to source data from an ancestor instead of an own provider.
    const transformer = new SceneDataTransformer({ transformations: [] });

    expect(getUntransformedDataProvider(transformer) === transformer).toBe(true);
  });
});
