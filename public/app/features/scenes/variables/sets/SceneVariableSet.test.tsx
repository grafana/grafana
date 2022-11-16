import { render, screen } from '@testing-library/react';
import React from 'react';
import { act } from 'react-dom/test-utils';

import { SceneCanvasText } from '../../components/SceneCanvasText';
import { SceneFlexLayout } from '../../components/layout/SceneFlexLayout';
import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneObjectStatePlain } from '../../core/types';
import { TestVariable } from '../variants/TestVariable';

import { SceneVariableSet } from './SceneVariableSet';

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
        $variables: new SceneVariableSet({ variables: [C, B, A] }),
      });

      scene.activate();

      // Should start variables with no dependencies
      expect(A.state.loading).toBe(true);
      expect(B.state.loading).toBe(undefined);
      expect(C.state.loading).toBe(undefined);

      // When A complete should start B
      A.signalUpdateCompleted();
      expect(A.state.value).toBe('AA');
      expect(A.state.issuedQuery).toBe('A.*');
      expect(A.state.loading).toBe(false);
      expect(B.state.loading).toBe(true);

      // Should wait with C as B is not completed yet
      expect(C.state.loading).toBe(undefined);

      // When B completes should now start C
      B.signalUpdateCompleted();
      expect(B.state.loading).toBe(false);
      expect(C.state.loading).toBe(true);

      // When C completes issue correct interpolated query containing the new values for A and B
      C.signalUpdateCompleted();
      expect(C.state.issuedQuery).toBe('A.AA.AAA.*');
    });
  });

  describe('When variable changes value', () => {
    it('Should start update process', async () => {
      const A = new TestVariable({ name: 'A', query: 'A.*', value: '', text: '', options: [] });
      const B = new TestVariable({ name: 'B', query: 'A.$A.*', value: '', text: '', options: [] });
      const C = new TestVariable({ name: 'C', query: 'A.$A.$B.*', value: '', text: '', options: [] });

      const scene = new TestScene({
        $variables: new SceneVariableSet({ variables: [C, B, A] }),
      });

      scene.activate();

      A.signalUpdateCompleted();
      B.signalUpdateCompleted();
      C.signalUpdateCompleted();

      // When changing A should start B but not C (yet)
      A.onSingleValueChange({ value: 'AB', text: 'AB' });

      expect(B.state.loading).toBe(true);
      expect(C.state.loading).toBe(false);

      B.signalUpdateCompleted();
      expect(B.state.value).toBe('ABA');
      expect(C.state.loading).toBe(true);
    });
  });

  describe('When deactivated', () => {
    it('Should cancel running variable queries', async () => {
      const A = new TestVariable({ name: 'A', query: 'A.*', value: '', text: '', options: [] });

      const scene = new TestScene({
        $variables: new SceneVariableSet({ variables: [A] }),
      });

      scene.activate();
      expect(A.isGettingValues).toBe(true);

      scene.deactivate();
      expect(A.isGettingValues).toBe(false);
    });

    describe('When update process completed and variables have changed values', () => {
      it('Should trigger re-renders of dependent scene objects', async () => {
        const A = new TestVariable({ name: 'A', query: 'A.*', value: '', text: '', options: [] });
        const B = new TestVariable({ name: 'B', query: 'A.$A.*', value: '', text: '', options: [] });

        const helloText = new SceneCanvasText({ text: 'Hello' });
        const sceneObjectWithVariable = new SceneCanvasText({ text: '$A - $B' });

        const scene = new SceneFlexLayout({
          $variables: new SceneVariableSet({ variables: [B, A] }),
          children: [helloText, sceneObjectWithVariable],
        });

        render(<scene.Component model={scene} />);

        expect(screen.getByText('Hello')).toBeInTheDocument();

        act(() => {
          A.signalUpdateCompleted();
          B.signalUpdateCompleted();
        });

        expect(screen.getByText('AA - AAA')).toBeInTheDocument();
        expect((helloText as any)._renderCount).toBe(1);
        expect((sceneObjectWithVariable as any)._renderCount).toBe(2);

        act(() => {
          B.onSingleValueChange({ value: 'B', text: 'B' });
        });

        expect(screen.getByText('AA - B')).toBeInTheDocument();
        expect((helloText as any)._renderCount).toBe(1);
        expect((sceneObjectWithVariable as any)._renderCount).toBe(3);
      });
    });
  });
});
