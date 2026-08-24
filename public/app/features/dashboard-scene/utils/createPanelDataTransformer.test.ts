import { SceneDataNode, SceneDataTransformer, type SceneDataProvider } from '@grafana/scenes';
import { type PanelModel } from 'app/features/dashboard/state/PanelModel';

import { PanelPluginTransformationsBehaviour } from '../scene/PanelPluginTransformationsBehaviour';

import { createPanelDataProvider } from './createPanelDataProvider';
import { createPanelDataTransformer } from './createPanelDataTransformer';

function pluginTransformationsBehaviours(provider: SceneDataProvider | undefined) {
  if (!(provider instanceof SceneDataTransformer)) {
    return [];
  }

  return (provider.state.$behaviors ?? []).filter(
    (behaviour) => behaviour instanceof PanelPluginTransformationsBehaviour
  );
}

describe('createPanelDataTransformer', () => {
  it('attaches the behaviour that runs the panel plugin’s transformations', () => {
    const transformer = createPanelDataTransformer({ transformations: [] });

    // Exactly one: a panel that registered two suppliers for the same origin would have the second
    // replace the first, so a duplicate would be invisible rather than loud.
    expect(pluginTransformationsBehaviours(transformer)).toHaveLength(1);
  });

  it('passes the caller’s state through untouched', () => {
    const source = new SceneDataNode();
    const transformations = [{ id: 'reduce', options: {} }];

    const transformer = createPanelDataTransformer({ $data: source, transformations });

    expect(transformer.state.$data).toBe(source);
    expect(transformer.state.transformations).toEqual(transformations);
  });
});

// The behaviour used to be pasted into every site that built a panel transformer, where missing one
// showed up as a panel quietly rendering untransformed data. This covers the path a v1 dashboard
// load actually takes, rather than a transformer the test built itself.
describe('createPanelDataProvider', () => {
  it('builds panels whose transformer runs the plugin’s transformations', () => {
    const panel = {
      id: 1,
      type: 'timeseries',
      targets: [{ refId: 'A' }],
      transformations: [],
    } as unknown as PanelModel;

    expect(pluginTransformationsBehaviours(createPanelDataProvider(panel, {}))).toHaveLength(1);
  });
});
