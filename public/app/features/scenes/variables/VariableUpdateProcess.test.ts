import { Subject } from 'rxjs';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneObjectStatePlain } from '../core/types';

import { SceneVariablesManager } from './SceneVariablesManager';
import { TestVariable } from './TestVariable';
import { VariableUpdateProcess } from './VariableUpdateProcess';

interface TestSceneState extends SceneObjectStatePlain {
  nested?: TestScene;
}

class TestScene extends SceneObjectBase<TestSceneState> {}

describe('VariableUpdateProcess', () => {
  it('should figure out dependencies and update in order', async () => {
    const completeVariable1 = new Subject<number>();
    const variables = new SceneVariablesManager({
      variables: [
        new TestVariable({
          key: 'server',
          name: 'server',
          query: 'A.*',
          value: 'server-initial',
          text: '',
          options: [],
          completeUpdate: completeVariable1,
        }),
        new TestVariable({
          key: 'pod',
          name: 'pod',
          query: 'A.$server.*',
          value: 'pod-initial',
          text: '',
          options: [],
          delayMs: 10000,
        }),
      ],
    });

    const scene = new TestScene({ $variables: variables });
    const updateProcess = new VariableUpdateProcess(scene);

    updateProcess.addVariable(variables.state.variables[0]);
    updateProcess.addVariable(variables.state.variables[1]);
    updateProcess.tick();

    expect(updateProcess.updating.get('server')).toBeDefined();
    expect(updateProcess.updating.get('pod')).toBeUndefined();

    completeVariable1.next(1);

    expect(updateProcess.updating.get('server')).toBeUndefined();
    expect(updateProcess.updating.get('pod')).toBeDefined();
  });
});
