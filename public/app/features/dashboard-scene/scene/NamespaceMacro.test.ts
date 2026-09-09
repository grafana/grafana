import { config } from '@grafana/runtime';
import { SceneCanvasText, sceneGraph, sceneUtils } from '@grafana/scenes';

import { NamespaceMacro } from './NamespaceMacro';

describe('NamespaceMacro', () => {
  let unregister: () => void;

  beforeAll(() => {
    unregister = sceneUtils.registerVariableMacro('__namespace', NamespaceMacro);
  });

  afterAll(() => {
    unregister();
  });

  it.each([
    ['stacks-123', 'apis/dashboard.grafana.app/v1beta1/namespaces/stacks-123/dashboards'],
    ['default', 'apis/dashboard.grafana.app/v1beta1/namespaces/default/dashboards'],
  ])('interpolates $__namespace as %s', (namespace, expected) => {
    config.namespace = namespace;

    const scene = new SceneCanvasText({ text: 'hello' });

    expect(sceneGraph.interpolate(scene, '$__namespace')).toBe(namespace);
    expect(
      sceneGraph.interpolate(scene, 'apis/dashboard.grafana.app/v1beta1/namespaces/${__namespace}/dashboards')
    ).toBe(expected);
  });
});
