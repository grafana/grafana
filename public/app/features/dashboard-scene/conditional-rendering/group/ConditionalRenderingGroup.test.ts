import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';

import { ConditionalRenderingChangedEvent } from '../../edit-pane/shared';
import { activateFullSceneTree } from '../../utils/test-utils';
import { ConditionalRenderingConditions } from '../conditions/types';

import { ConditionalRenderingGroup, ConditionalRenderingGroupState } from './ConditionalRenderingGroup';

interface StubConditionState extends SceneObjectState {
  value: boolean;
  result: boolean | undefined;
}

class StubCondition extends SceneObjectBase<StubConditionState> {
  public forceCheckCalled = false;

  public forceCheck() {
    this.forceCheckCalled = true;
  }

  public changeValue(value: boolean) {
    this.setState({ value, result: value });
  }

  public serialize() {
    return { kind: 'ConditionalRenderingData' as const, spec: { value: this.state.value } };
  }

  public renderCmp() {
    return null as never;
  }
}

function buildGroup({
  conditions = [],
  condition = 'and',
  visibility = 'show',
  result = true,
  renderHidden = false,
}: Partial<ConditionalRenderingGroupState> = {}) {
  const group = new ConditionalRenderingGroup({
    conditions,
    condition,
    visibility,
    result,
    renderHidden,
  });

  return { group };
}

function buildConditions({ results = [] }: { results: Array<boolean | undefined> }) {
  return results.map(
    (result) => new StubCondition({ value: result ?? false, result }) as unknown as ConditionalRenderingConditions
  );
}

describe('ConditionalRenderingGroup', () => {
  describe('check', () => {
    describe('when visibility=show and condition=and', () => {
      test('when all conditions are true, result is true', () => {
        const conditions = buildConditions({ results: [true, true, true] });
        const { group } = buildGroup({ conditions, visibility: 'show', condition: 'and' });

        activateFullSceneTree(group);

        expect(group.state.result).toBe(true);
      });

      test('when one condition is false, result is false', () => {
        const conditions = buildConditions({ results: [true, false, true] });
        const { group } = buildGroup({ conditions, visibility: 'show', condition: 'and' });

        activateFullSceneTree(group);

        expect(group.state.result).toBe(false);
      });
    });

    describe('when visibility=show and condition=or', () => {
      test('when at least one condition is true, result is true', () => {
        const conditions = buildConditions({ results: [false, true, false] });
        const { group } = buildGroup({ conditions, visibility: 'show', condition: 'or' });

        activateFullSceneTree(group);

        expect(group.state.result).toBe(true);
      });

      test('when all conditions are false, result is false', () => {
        const conditions = buildConditions({ results: [false, false, false] });
        const { group } = buildGroup({ conditions, visibility: 'show', condition: 'or' });

        activateFullSceneTree(group);

        expect(group.state.result).toBe(false);
      });
    });

    describe('when visibility=hide and condition=and', () => {
      test('when all conditions are true, result is false (negated)', () => {
        const conditions = buildConditions({ results: [true, true] });
        const { group } = buildGroup({ conditions, visibility: 'hide', condition: 'and' });

        activateFullSceneTree(group);

        expect(group.state.result).toBe(false);
      });

      test('when one condition is false, result is true (negated)', () => {
        const conditions = buildConditions({ results: [true, false] });
        const { group } = buildGroup({ conditions, visibility: 'hide', condition: 'and' });

        activateFullSceneTree(group);

        expect(group.state.result).toBe(true);
      });
    });

    describe('when visibility=hide and condition=or', () => {
      test('when at least one condition is true, result is false (negated)', () => {
        const conditions = buildConditions({ results: [false, true] });
        const { group } = buildGroup({ conditions, visibility: 'hide', condition: 'or' });

        activateFullSceneTree(group);

        expect(group.state.result).toBe(false);
      });

      test('when all conditions are false, result is true (negated)', () => {
        const conditions = buildConditions({ results: [false, false] });
        const { group } = buildGroup({ conditions, visibility: 'hide', condition: 'or' });

        activateFullSceneTree(group);

        expect(group.state.result).toBe(true);
      });
    });

    describe('when conditions have undefined results', () => {
      test('conditions with undefined result are filtered out', () => {
        const conditions = buildConditions({ results: [undefined, true] });
        const { group } = buildGroup({ conditions, visibility: 'show', condition: 'and' });

        activateFullSceneTree(group);

        expect(group.state.result).toBe(true);
      });

      test('when all conditions have undefined result, result defaults to true', () => {
        const conditions = buildConditions({ results: [undefined, undefined] });
        const { group } = buildGroup({ conditions, visibility: 'show', condition: 'and' });

        activateFullSceneTree(group);

        expect(group.state.result).toBe(true);
      });
    });

    test('when conditions list is empty, result defaults to true', () => {
      const { group } = buildGroup({ conditions: [], visibility: 'show', condition: 'and' });

      activateFullSceneTree(group);

      expect(group.state.result).toBe(true);
    });

    test('when result changes, publishes ConditionalRenderingChangedEvent', () => {
      const conditions = buildConditions({ results: [true] });
      const { group } = buildGroup({ conditions, visibility: 'show', condition: 'and', result: false });
      const eventHandler = jest.fn();

      group.subscribeToEvent(ConditionalRenderingChangedEvent, eventHandler);
      activateFullSceneTree(group);

      expect(eventHandler).toHaveBeenCalledTimes(1);
    });

    test('when result does not change, no event is published', () => {
      const conditions = buildConditions({ results: [true] });
      const { group } = buildGroup({ conditions, visibility: 'show', condition: 'and', result: true });
      const eventHandler = jest.fn();

      group.subscribeToEvent(ConditionalRenderingChangedEvent, eventHandler);
      activateFullSceneTree(group);

      expect(eventHandler).not.toHaveBeenCalled();
    });
  });
});
