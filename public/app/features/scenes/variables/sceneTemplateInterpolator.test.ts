import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneObjectStatePlain } from '../core/types';

import { sceneTemplateInterpolator } from './sceneTemplateInterpolator';
import { SceneVariableSet } from './sets/SceneVariableSet';
import { ConstantVariable } from './variants/ConstantVariable';

interface TestSceneState extends SceneObjectStatePlain {
  nested?: TestScene;
}

class TestScene extends SceneObjectBase<TestSceneState> {}

describe('sceneTemplateInterpolator', () => {
  it('Should be interpolate and use closest variable', () => {
    const scene = new TestScene({
      $variables: new SceneVariableSet({
        variables: [
          new ConstantVariable({
            name: 'test',
            value: 'hello',
          }),
          new ConstantVariable({
            name: 'atRootOnly',
            value: 'RootValue',
          }),
        ],
      }),
      nested: new TestScene({
        $variables: new SceneVariableSet({
          variables: [
            new ConstantVariable({
              name: 'test',
              value: 'nestedValue',
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
