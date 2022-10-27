import { LoadingState } from '@grafana/data';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneObjectStatePlain } from '../core/types';

import { SceneVariableList } from './SceneVariableList';
import { TestVariable } from './TestVariable';

interface TestSceneState extends SceneObjectStatePlain {
  nested?: TestScene;
}

class TestScene extends SceneObjectBase<TestSceneState> {}

describe('SceneVariableList', () => {
  it('should figure out dependencies and update in order', async () => {
    const server = new TestVariable({ name: 'server', query: 'A.*', value: 'server-initial', text: '', options: [] });
    const pod = new TestVariable({ name: 'pod', query: 'A.$server.*', value: 'pod-initial', text: '', options: [] });

    const scene = new TestScene({
      $variables: new SceneVariableList({ variables: [server, pod] }),
    });

    scene.activate();

    expect(server.state.state).toBe(LoadingState.Loading);
    expect(pod.state.state).toBe(undefined);

    server.signalUpdateCompleted();

    expect(server.state.value).toBe('AA');
    expect(server.state.issuedQuery).toBe('A.*');
    expect(server.state.state).toBe(LoadingState.Done);

    expect(pod.state.state).toBe(LoadingState.Loading);

    pod.signalUpdateCompleted();
    expect(pod.state.value).toBe('AAA');
    expect(pod.state.state).toBe(LoadingState.Done);
  });

  it('Complex dependency order', async () => {
    const A = new TestVariable({ name: 'A', query: 'A.*', value: '', text: '', options: [] });
    const B = new TestVariable({ name: 'B', query: 'B.*', value: '', text: '', options: [] });
    const C = new TestVariable({ name: 'C', query: '$A.$B.*', value: '', text: '', options: [] });

    const scene = new TestScene({
      $variables: new SceneVariableList({ variables: [C, B, A] }),
    });

    scene.activate();

    expect(A.state.state).toBe(LoadingState.Loading);
    expect(B.state.state).toBe(LoadingState.Loading);
    expect(C.state.state).toBe(undefined);

    A.signalUpdateCompleted();
    expect(A.state.state).toBe(LoadingState.Done);
    expect(C.state.state).toBe(undefined);

    B.signalUpdateCompleted();
    expect(C.state.state).toBe(LoadingState.Loading);

    C.signalUpdateCompleted();
    expect(C.state.issuedQuery).toBe('AA.BA.*');
  });

  describe('When variable changes value', () => {
    it('When variable changes value', async () => {
      const A = new TestVariable({ name: 'A', query: 'A.*', value: '', text: '', options: [] });
      const B = new TestVariable({ name: 'B', query: 'A.$A', value: '', text: '', options: [] });
      const C = new TestVariable({ name: 'C', query: 'A.$A.$B', value: '', text: '', options: [] });

      const scene = new TestScene({
        $variables: new SceneVariableList({ variables: [C, B, A] }),
      });

      scene.activate();

      A.signalUpdateCompleted();
      B.signalUpdateCompleted();
      C.signalUpdateCompleted();

      A.setState({ value: 'AB' });

      expect(B.state.state).toBe(LoadingState.Loading);

      B.signalUpdateCompleted();
      expect(B.state.value).toBe('ABA');

      expect(C.state.state).toBe(LoadingState.Loading);
    });
  });
});
