import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneObjectStatePlain } from '../../core/types';
import { SceneVariableSet } from '../sets/SceneVariableSet';
import { ConstantVariable } from '../variants/ConstantVariable';
import { ObjectVariable } from '../variants/ObjectVariable';
import { TestVariable } from '../variants/TestVariable';

import { sceneInterpolator } from './sceneInterpolator';

interface TestSceneState extends SceneObjectStatePlain {
  nested?: TestScene;
}

class TestScene extends SceneObjectBase<TestSceneState> {}

describe('sceneInterpolator', () => {
  it('Should be interpolated and use closest variable', () => {
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

    expect(sceneInterpolator(scene, '${test}')).toBe('hello');
    expect(sceneInterpolator(scene.state.nested!, '${test}')).toBe('nestedValue');
    expect(sceneInterpolator(scene.state.nested!, '${atRootOnly}')).toBe('RootValue');
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

      expect(sceneInterpolator(scene, '${test.prop1}')).toBe('prop1Value');
    });
  });

  it('Can use format', () => {
    const scene = new TestScene({
      $variables: new SceneVariableSet({
        variables: [
          new ConstantVariable({
            name: 'test',
            value: 'hello',
          }),
        ],
      }),
    });

    expect(sceneInterpolator(scene, '${test:queryparam}')).toBe('var-test=hello');
  });

  it('Can format multi valued values', () => {
    const scene = new TestScene({
      $variables: new SceneVariableSet({
        variables: [
          new TestVariable({
            name: 'test',
            value: ['hello', 'world'],
          }),
        ],
      }),
    });

    expect(sceneInterpolator(scene, 'test.${test}.asd')).toBe('test.{hello,world}.asd');
  });

  it('Can format multi valued values using text formatter', () => {
    const scene = new TestScene({
      $variables: new SceneVariableSet({
        variables: [
          new TestVariable({
            name: 'test',
            value: ['1', '2'],
            text: ['hello', 'world'],
          }),
        ],
      }),
    });

    expect(sceneInterpolator(scene, '${test:text}')).toBe('hello + world');
  });

  it('Can use formats with arguments', () => {
    const scene = new TestScene({
      $variables: new SceneVariableSet({
        variables: [
          new TestVariable({
            name: 'test',
            value: 1594671549254,
          }),
        ],
      }),
    });

    expect(sceneInterpolator(scene, '${test:date:YYYY-MM}')).toBe('2020-07');
  });

  it('Can use scopedVars', () => {
    const scene = new TestScene({
      $variables: new SceneVariableSet({
        variables: [],
      }),
    });

    const scopedVars = { __from: { value: 'a', text: 'b' } };

    expect(sceneInterpolator(scene, '${__from}', scopedVars)).toBe('a');
    expect(sceneInterpolator(scene, '${__from:text}', scopedVars)).toBe('b');
  });

  it('Can use scopedVars with fieldPath', () => {
    const scene = new TestScene({
      $variables: new SceneVariableSet({
        variables: [],
      }),
    });

    const scopedVars = { __data: { value: { name: 'Main org' }, text: '' } };
    expect(sceneInterpolator(scene, '${__data.name}', scopedVars)).toBe('Main org');
  });
});
