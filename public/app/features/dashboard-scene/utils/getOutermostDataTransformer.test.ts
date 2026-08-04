import { SceneDataTransformer, SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { PanelPluginDataTransformer } from '../scene/PanelPluginDataTransformer';

import { getOutermostDataTransformer } from './getOutermostDataTransformer';

describe('getOutermostDataTransformer', () => {
  it('returns the user transformer wrapping a query runner', () => {
    const queryRunner = new SceneQueryRunner({ queries: [{ refId: 'A' }] });
    const userTransformer = new SceneDataTransformer({ $data: queryRunner, transformations: [] });

    // Compared as a boolean: scene objects hold circular references, so a failing `toBe`
    // diff cannot be serialized by the jest reporter.
    expect(getOutermostDataTransformer(queryRunner) === userTransformer).toBe(true);
  });

  it('walks past a nested panel-plugin transformer to the user transformer', () => {
    const queryRunner = new SceneQueryRunner({ queries: [{ refId: 'A' }] });
    const pluginTransformer = new PanelPluginDataTransformer({ $data: queryRunner, transformations: [] });
    const userTransformer = new SceneDataTransformer({ $data: pluginTransformer, transformations: [] });

    // Stopping at the immediate parent would pick the plugin transformer, whose
    // `transformations` always holds its one operator — so the behaviour would take the
    // has-transformations branch for every panel, whether or not the user has any.
    const found = getOutermostDataTransformer(queryRunner);

    expect(found === userTransformer).toBe(true);
    expect(found!.state.transformations).toHaveLength(0);
  });

  it('returns undefined when no transformer wraps the query runner', () => {
    const queryRunner = new SceneQueryRunner({ queries: [{ refId: 'A' }] });
    new VizPanel({ pluginId: 'timeseries', $data: queryRunner });

    expect(getOutermostDataTransformer(queryRunner)).toBeUndefined();
  });
});
