import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneObjectStatePlain } from '../core/types';

import { sceneTemplateInterpolator } from './sceneTemplateInterpolator';
import { SceneVariableSet } from './sets/SceneVariableSet';
import { ConstantVariable } from './variants/ConstantVariable';
import { ObjectVariable } from './variants/ObjectVariable';

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

  describe('Given an expression with fieldPath', () => {
    it('Should interpolate correctly', () => {
      const scene = new TestScene({
        $variables: new SceneVariableSet({
          variables: [
            new ObjectVariable({
              name: 'test',
              value: { prop1: 'prop1Value' },
            }),
          ],
        }),
      });

      expect(sceneTemplateInterpolator('${test.prop1}', scene)).toBe('prop1Value');
    });
  });
});
