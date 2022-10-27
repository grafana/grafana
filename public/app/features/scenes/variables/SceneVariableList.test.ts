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
  describe('When activated', () => {
    it('Should update variables in dependency order', async () => {
      const A = new TestVariable({ name: 'A', query: 'A.*', value: '', text: '', options: [] });
      const B = new TestVariable({ name: 'B', query: 'A.$A', value: '', text: '', options: [] });
      const C = new TestVariable({ name: 'C', query: 'A.$A.$B.*', value: '', text: '', options: [] });

      const scene = new TestScene({
        $variables: new SceneVariableList({ variables: [C, B, A] }),
      });

      scene.activate();

      // Should start variables with no dependencies
      expect(A.state.state).toBe(LoadingState.Loading);
      expect(B.state.state).toBe(undefined);
      expect(C.state.state).toBe(undefined);

      // When A complete should start B
      A.signalUpdateCompleted();
      expect(A.state.value).toBe('AA');
      expect(A.state.issuedQuery).toBe('A.*');
      expect(A.state.state).toBe(LoadingState.Done);
      expect(B.state.state).toBe(LoadingState.Loading);

      // Should wait with C as B is not completed yet
      expect(C.state.state).toBe(undefined);

      // When B completes should now start C
      B.signalUpdateCompleted();
      expect(B.state.state).toBe(LoadingState.Done);
      expect(C.state.state).toBe(LoadingState.Loading);

      // When C completes issue correct interpolated query containing the new values for A and B
      C.signalUpdateCompleted();
      expect(C.state.issuedQuery).toBe('A.AA.AAA.*');
    });
  });

  describe('When variable changes value', () => {
    it('When variable changes value', async () => {
      const A = new TestVariable({ name: 'A', query: 'A.*', value: '', text: '', options: [] });
      const B = new TestVariable({ name: 'B', query: 'A.$A.*', value: '', text: '', options: [] });
      const C = new TestVariable({ name: 'C', query: 'A.$A.$B.*', value: '', text: '', options: [] });

      const scene = new TestScene({
        $variables: new SceneVariableList({ variables: [C, B, A] }),
      });

      scene.activate();

      A.signalUpdateCompleted();
      B.signalUpdateCompleted();
      C.signalUpdateCompleted();

      // When changing A should start dependent B to loading but not C
      A.setState({ value: 'AB' });
      expect(B.state.state).toBe(LoadingState.Loading);
      expect(C.state.state).toBe(LoadingState.Done);

      B.signalUpdateCompleted();
      expect(B.state.value).toBe('ABA');
      expect(C.state.state).toBe(LoadingState.Loading);
    });
  });
});
