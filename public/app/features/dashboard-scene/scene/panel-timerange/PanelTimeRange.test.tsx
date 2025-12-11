import { advanceTo, clear } from 'jest-date-mock';

import { dateTime } from '@grafana/data';
import {
  SceneCanvasText,
  SceneFlexItem,
  SceneFlexLayout,
  SceneTimeRange,
  SceneVariableSet,
  TestVariable,
} from '@grafana/scenes';

import { activateFullSceneTree } from '../../utils/test-utils';

import { PanelTimeRange } from './PanelTimeRange';

describe('PanelTimeRange', () => {
  const fakeCurrentDate = dateTime('2019-02-11T19:00:00.000Z').toDate();

  beforeAll(() => {
    advanceTo(fakeCurrentDate);
  });

  afterAll(() => {
    clear();
  });

  it('should apply relative time override', () => {
    const panelTime = new PanelTimeRange({ timeFrom: '2h' });

    buildAndActivateSceneFor(panelTime);

    expect(panelTime.state.value.from.toISOString()).toBe('2019-02-11T17:00:00.000Z');
    expect(panelTime.state.value.to.toISOString()).toBe(fakeCurrentDate.toISOString());
    expect(panelTime.state.value.raw.from).toBe('now-2h');
    expect(panelTime.state.timeInfo).toBe('Last 2 hours');
  });

  it('should apply time shift', () => {
    const panelTime = new PanelTimeRange({ timeShift: '2h' });

    buildAndActivateSceneFor(panelTime);

    expect(panelTime.state.value.from.toISOString()).toBe('2019-02-11T11:00:00.000Z');
    expect(panelTime.state.value.to.toISOString()).toBe('2019-02-11T17:00:00.000Z');
    expect(panelTime.state.timeInfo).toBe('Timeshift -2h');
  });

  it('should apply both relative time and time shift', () => {
    const panelTime = new PanelTimeRange({ timeFrom: '2h', timeShift: '2h' });

    buildAndActivateSceneFor(panelTime);

    expect(panelTime.state.value.from.toISOString()).toBe('2019-02-11T15:00:00.000Z');
    expect(panelTime.state.timeInfo).toBe('Last 2 hours + timeshift -2h');
  });

  it('should add time comparison to timeInfo', () => {
    const panelTime = new PanelTimeRange({ compareWith: '1d' });

    buildAndActivateSceneFor(panelTime);

    expect(panelTime.state.timeInfo).toBe('Compared to day before');
  });

  it('should add time override and time comparison to timeInfo', () => {
    const panelTime = new PanelTimeRange({ timeFrom: '1h', compareWith: '1d' });

    buildAndActivateSceneFor(panelTime);

    expect(panelTime.state.timeInfo).toBe('Last 1 hour + compared to day before');
  });

  it('should update timeInfo when timeShift and timeFrom are variable expressions', async () => {
    const customTimeFrom = new TestVariable({
      name: 'testFrom',
      value: '10s',
    });
    const customTimeShift = new TestVariable({
      name: 'testShift',
      value: '20s',
    });
    const panelTime = new PanelTimeRange({ timeFrom: '$testFrom', timeShift: '$testShift' });
    const panel = new SceneCanvasText({ text: 'Hello', $timeRange: panelTime });
    const scene = new SceneFlexLayout({
      $variables: new SceneVariableSet({
        variables: [customTimeFrom, customTimeShift],
      }),
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      children: [new SceneFlexItem({ body: panel })],
    });
    activateFullSceneTree(scene);

    expect(panelTime.state.timeInfo).toBe('Last 10 seconds + timeshift -20s');

    customTimeFrom.setState({ value: '15s' });
    customTimeShift.setState({ value: '25s' });

    panelTime.forceRender();

    expect(panelTime.state.timeInfo).toBe('Last 15 seconds + timeshift -25s');
  });

  it('should update panelTimeRange from/to based on scene timeRange on activate', () => {
    const panelTime = new PanelTimeRange({});
    const panel = new SceneCanvasText({ text: 'Hello', $timeRange: panelTime });
    const scene = new SceneFlexLayout({
      $timeRange: new SceneTimeRange({ from: 'now-12h', to: 'now-2h' }),
      children: [new SceneFlexItem({ body: panel })],
    });
    activateFullSceneTree(scene);

    expect(panelTime.state.from).toBe('now-12h');
    expect(panelTime.state.to).toBe('now-2h');
  });

  it('should properly apply timeZone', () => {
    const panelTime = new PanelTimeRange({ timeFrom: '2h' });

    const panel = new SceneCanvasText({ text: 'Hello', $timeRange: panelTime });
    const scene = new SceneFlexLayout({
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now', timeZone: 'utc' }),
      children: [new SceneFlexItem({ body: panel })],
    });
    activateFullSceneTree(scene);

    expect(panelTime.state.value.from.format('Z')).toBe('+00:00'); // UTC
    expect(panelTime.state.value.to.format('Z')).toBe('+00:00'); // UTC
  });

  it('should handle invalid time reference in timeShift', () => {
    const panelTime = new PanelTimeRange({ timeShift: 'now-1d' });

    buildAndActivateSceneFor(panelTime);

    expect(panelTime.state.timeInfo).toBe('invalid timeshift');
    // Should not be affected by invalid timeShift
    expect(panelTime.state.from).toBe('now-6h');
    expect(panelTime.state.to).toBe('now');
  });

  it('should handle invalid time reference in timeShift combined with timeFrom', () => {
    const panelTime = new PanelTimeRange({
      timeFrom: 'now-2h',
      timeShift: 'now-1d',
    });

    buildAndActivateSceneFor(panelTime);

    expect(panelTime.state.timeInfo).toBe('invalid timeshift');
    // Should not be affected by invalid timeShift
    expect(panelTime.state.from).toBe('now-2h');
    expect(panelTime.state.to).toBe('now');
  });

  describe('onTimeRangeChange', () => {
    it('should reverse timeShift when updating time range', () => {
      const oneHourShift = '1h';
      const panelTime = new PanelTimeRange({ timeShift: oneHourShift });
      const sceneTimeRange = new SceneTimeRange({ from: 'now-6h', to: 'now' });
      const panel = new SceneCanvasText({ text: 'Hello', $timeRange: panelTime });
      const scene = new SceneFlexLayout({
        $timeRange: sceneTimeRange,
        children: [new SceneFlexItem({ body: panel })],
      });

      activateFullSceneTree(scene);

      const panelTimeFrom = dateTime('2019-02-11T12:00:00.000Z');
      const panelTimeTo = dateTime('2019-02-11T18:00:00.000Z');

      panelTime.onTimeRangeChange({
        from: panelTimeFrom,
        to: panelTimeTo,
        raw: { from: panelTimeFrom, to: panelTimeTo },
      });

      const expectedDashboardTimeFrom = dateTime('2019-02-11T13:00:00.000Z');
      const expectedDashboardTimeTo = dateTime('2019-02-11T19:00:00.000Z');

      expect(sceneTimeRange.state.value.from.toISOString()).toBe(expectedDashboardTimeFrom.toISOString());
      expect(sceneTimeRange.state.value.to.toISOString()).toBe(expectedDashboardTimeTo.toISOString());
    });

    it('should pass through time range when no timeShift is configured', () => {
      const panelTime = new PanelTimeRange({});
      const sceneTimeRange = new SceneTimeRange({ from: 'now-6h', to: 'now' });
      const panel = new SceneCanvasText({ text: 'Hello', $timeRange: panelTime });
      const scene = new SceneFlexLayout({
        $timeRange: sceneTimeRange,
        children: [new SceneFlexItem({ body: panel })],
      });

      activateFullSceneTree(scene);

      const userSelectedFrom = dateTime('2019-02-11T12:00:00.000Z');
      const userSelectedTo = dateTime('2019-02-11T18:00:00.000Z');

      panelTime.onTimeRangeChange({
        from: userSelectedFrom,
        to: userSelectedTo,
        raw: { from: userSelectedFrom, to: userSelectedTo },
      });

      expect(sceneTimeRange.state.value.from.toISOString()).toBe(userSelectedFrom.toISOString());
      expect(sceneTimeRange.state.value.to.toISOString()).toBe(userSelectedTo.toISOString());
    });

    it('should handle variable expressions in timeShift', () => {
      const twoHourShiftValue = '2h';
      const customTimeShift = new TestVariable({
        name: 'testShift',
        value: twoHourShiftValue,
      });
      const panelTime = new PanelTimeRange({ timeShift: '$testShift' });
      const sceneTimeRange = new SceneTimeRange({ from: 'now-6h', to: 'now' });
      const panel = new SceneCanvasText({ text: 'Hello', $timeRange: panelTime });
      const scene = new SceneFlexLayout({
        $variables: new SceneVariableSet({
          variables: [customTimeShift],
        }),
        $timeRange: sceneTimeRange,
        children: [new SceneFlexItem({ body: panel })],
      });

      activateFullSceneTree(scene);

      const panelTimeFrom = dateTime('2019-02-11T11:00:00.000Z');
      const panelTimeTo = dateTime('2019-02-11T17:00:00.000Z');

      panelTime.onTimeRangeChange({
        from: panelTimeFrom,
        to: panelTimeTo,
        raw: { from: panelTimeFrom, to: panelTimeTo },
      });

      const expectedDashboardTimeFrom = dateTime('2019-02-11T13:00:00.000Z');
      const expectedDashboardTimeTo = dateTime('2019-02-11T19:00:00.000Z');

      expect(sceneTimeRange.state.value.from.toISOString()).toBe(expectedDashboardTimeFrom.toISOString());
      expect(sceneTimeRange.state.value.to.toISOString()).toBe(expectedDashboardTimeTo.toISOString());
    });
  });
});

function buildAndActivateSceneFor(panelTime: PanelTimeRange) {
  const panel = new SceneCanvasText({ text: 'Hello', $timeRange: panelTime });
  const scene = new SceneFlexLayout({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    children: [new SceneFlexItem({ body: panel })],
  });
  activateFullSceneTree(scene);
}
