import { dateTime } from '@grafana/data';
import { SceneTimeRange } from '@grafana/scenes';

import { activateFullSceneTree } from '../../utils/test-utils';
import { ConditionalRenderingGroup } from '../group/ConditionalRenderingGroup';

import { ConditionalRenderingTimeRangeSize } from './ConditionalRenderingTimeRangeSize';

function buildSceneTree({
  condition,
  from,
  to,
}: {
  condition: ConditionalRenderingTimeRangeSize;
  from: string;
  to: string;
}) {
  const timeRange = new SceneTimeRange({ from, to });

  const group = new ConditionalRenderingGroup({
    conditions: [condition],
    condition: 'and',
    visibility: 'show',
    result: true,
    renderHidden: false,
    $timeRange: timeRange,
  });

  return { group, timeRange };
}

describe('ConditionalRenderingTimeRangeSize', () => {
  describe('evaluation', () => {
    test('when time range (1h) is shorter than threshold (7d), result is true', () => {
      const condition = new ConditionalRenderingTimeRangeSize({ value: '7d', result: undefined });
      const { group } = buildSceneTree({ condition, from: 'now-1h', to: 'now' });

      activateFullSceneTree(group);

      expect(condition.state.result).toBe(true);
    });

    test('when time range (30d) is longer than threshold (7d), result is false', () => {
      const condition = new ConditionalRenderingTimeRangeSize({ value: '7d', result: undefined });
      const { group } = buildSceneTree({ condition, from: 'now-30d', to: 'now' });

      activateFullSceneTree(group);

      expect(condition.state.result).toBe(false);
    });

    test('when time range equals threshold exactly, result is true', () => {
      const condition = new ConditionalRenderingTimeRangeSize({ value: '7d', result: undefined });
      const { group } = buildSceneTree({ condition, from: 'now-7d', to: 'now' });

      activateFullSceneTree(group);

      expect(condition.state.result).toBe(true);
    });

    test('when interval value is invalid, result is undefined', () => {
      const condition = new ConditionalRenderingTimeRangeSize({ value: 'abc', result: undefined });
      const { group } = buildSceneTree({ condition, from: 'now-1h', to: 'now' });

      activateFullSceneTree(group);

      expect(condition.state.result).toBeUndefined();
    });

    test('when interval value is empty, result is undefined', () => {
      const condition = new ConditionalRenderingTimeRangeSize({ value: '', result: undefined });
      const { group } = buildSceneTree({ condition, from: 'now-1h', to: 'now' });

      activateFullSceneTree(group);

      expect(condition.state.result).toBeUndefined();
    });
  });

  describe('reactivity', () => {
    test('when time range changes, result is recalculated', () => {
      const condition = new ConditionalRenderingTimeRangeSize({ value: '7d', result: undefined });
      const { group, timeRange } = buildSceneTree({ condition, from: 'now-1h', to: 'now' });

      activateFullSceneTree(group);

      const now = dateTime();
      timeRange.onTimeRangeChange({
        from: dateTime(now).subtract(30, 'days'),
        to: now,
        raw: { from: 'now-30d', to: 'now' },
      });

      expect(condition.state.result).toBe(false);
    });

    test('when result changes, it triggers a group check', () => {
      const condition = new ConditionalRenderingTimeRangeSize({ value: '7d', result: undefined });
      const { group, timeRange } = buildSceneTree({ condition, from: 'now-1h', to: 'now' });

      activateFullSceneTree(group);

      const checkSpy = jest.spyOn(group, 'check');

      const now = dateTime();
      timeRange.onTimeRangeChange({
        from: dateTime(now).subtract(30, 'days'),
        to: now,
        raw: { from: 'now-30d', to: 'now' },
      });

      expect(checkSpy).toHaveBeenCalled();
    });
  });

  describe('changeValue', () => {
    test('when value changes, result is recalculated', () => {
      const condition = new ConditionalRenderingTimeRangeSize({ value: '7d', result: undefined });
      const { group } = buildSceneTree({ condition, from: 'now-30d', to: 'now' });

      activateFullSceneTree(group);

      condition.changeValue('90d');

      expect(condition.state.result).toBe(true);
    });

    test('when value is set to the same value, state and result are not updated', () => {
      const condition = new ConditionalRenderingTimeRangeSize({ value: '7d', result: undefined });
      const { group } = buildSceneTree({ condition, from: 'now-1h', to: 'now' });

      activateFullSceneTree(group);

      const resultBefore = condition.state.result;
      const setStateSpy = jest.spyOn(condition, 'setState');

      condition.changeValue('7d');

      expect(setStateSpy).not.toHaveBeenCalled();
      expect(condition.state.result).toBe(resultBefore);
    });
  });

  describe('serialization', () => {
    test('serialize() returns the correct kind and spec', () => {
      const condition = new ConditionalRenderingTimeRangeSize({ value: '7d', result: undefined });

      const result = condition.serialize();

      expect(result).toEqual({
        kind: 'ConditionalRenderingTimeRangeSize',
        spec: { value: '7d' },
      });
    });

    test('deserialize() creates an instance with the correct state', () => {
      const model = { kind: 'ConditionalRenderingTimeRangeSize' as const, spec: { value: '30d' } };

      const condition = ConditionalRenderingTimeRangeSize.deserialize(model);

      expect(condition).toBeInstanceOf(ConditionalRenderingTimeRangeSize);
      expect(condition.state.value).toBe('30d');
      expect(condition.state.result).toBeUndefined();
    });
  });

  test('createEmpty() defaults to value=7d and result=undefined', () => {
    const condition = ConditionalRenderingTimeRangeSize.createEmpty();

    expect(condition).toBeInstanceOf(ConditionalRenderingTimeRangeSize);
    expect(condition.state.value).toBe('7d');
    expect(condition.state.result).toBeUndefined();
  });
});
