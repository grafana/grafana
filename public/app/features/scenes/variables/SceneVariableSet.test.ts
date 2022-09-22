import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneObjectStatePlain } from '../core/types';

import { sceneTemplateInterpolator, SceneVariableManager, TextBoxSceneVariable } from './SceneVariableSet';

interface TestSceneState extends SceneObjectStatePlain {
  nested?: TestScene;
}

class TestScene extends SceneObjectBase<TestSceneState> {}

describe('SceneObject with variables', () => {
  it('Should be interpolate and use closest variable', () => {
    const scene = new TestScene({
      $variables: new SceneVariableManager({
        variables: [
          new TextBoxSceneVariable({
            name: 'test',
            current: { value: 'hello' },
          }),
          new TextBoxSceneVariable({
            name: 'atRootOnly',
            current: { value: 'RootValue' },
          }),
        ],
      }),
      nested: new TestScene({
        $variables: new SceneVariableManager({
          variables: [
            new TextBoxSceneVariable({
              name: 'test',
              current: { value: 'nestedValue' },
            }),
          ],
        }),
      }),
    });

    expect(sceneTemplateInterpolator('${test}', scene)).toBe('hello');
    expect(sceneTemplateInterpolator('${test}', scene.state.nested!)).toBe('nestedValue');
    expect(sceneTemplateInterpolator('${atRootOnly}', scene.state.nested!)).toBe('RootValue');
  });
});
