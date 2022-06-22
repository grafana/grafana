import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneObjectState } from '../core/types';

import { sceneTemplateInterpolator, SceneVariableManager, TextBoxSceneVariable } from './SceneVariableSet';

interface TestItemState extends SceneObjectState {
  nested?: TestItem;
}

class TestItem extends SceneObjectBase<TestItemState> {}

describe('SceneObject with variables', () => {
  it('Should be interpolate and use closest variable', () => {
    const scene = new TestItem({
      $variables: new SceneVariableManager({
        variables: [
          new TextBoxSceneVariable({
            name: 'test',
            current: { value: 'hello' },
          }),
        ],
      }),
      nested: new TestItem({
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
  });
});
