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

import { activateFullSceneTree } from '../utils/test-utils';

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
    expect(panelTime.state.timeInfo).toBe(' timeshift -2h');
  });

  it('should apply both relative time and time shift', () => {
    const panelTime = new PanelTimeRange({ timeFrom: '2h', timeShift: '2h' });

    buildAndActivateSceneFor(panelTime);

    expect(panelTime.state.value.from.toISOString()).toBe('2019-02-11T15:00:00.000Z');
    expect(panelTime.state.timeInfo).toBe('Last 2 hours timeshift -2h');
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

    expect(panelTime.state.timeInfo).toBe('Last 10 seconds timeshift -20s');

    customTimeFrom.setState({ value: '15s' });
    customTimeShift.setState({ value: '25s' });

    panelTime.forceRender();

    expect(panelTime.state.timeInfo).toBe('Last 15 seconds timeshift -25s');
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
