import {
  type DataFrame,
  FieldType,
  LoadingState,
  type PanelData,
  TIME_SERIES_TIME_FIELD_NAME,
  getDefaultTimeRange,
  toDataFrame,
} from '@grafana/data';
import { SceneQueryRunner, SceneTimeRange, VizPanel } from '@grafana/scenes';

import { createTimeWindowGroups } from './FanoutByTimeWindow';
import { type TimeWindowSplitGroup } from './FanoutPanel';

describe('createTimeWindowGroups', () => {
  it('returns the panel data unmodified as the most recent window', () => {
    const { panel, data } = setup();

    const groups = createTimeWindowGroups(panel, data, 'd', 2);

    expect(groups[0]).toEqual({ type: 'data', name: 'Panel A', frames: data.series });
  });

  it('returns one time shifted group per window in addition to the most recent window', () => {
    const { panel, data } = setup();

    const groups = createTimeWindowGroups(panel, data, 'd', 3);

    expect(groups).toHaveLength(4);
    expect(groups.map((group) => group.type)).toEqual(['data', 'timeWindow', 'timeWindow', 'timeWindow']);
  });

  it('shifts each window one more time window back than the previous', () => {
    const { panel, data } = setup();

    const groups = createTimeWindowGroups(panel, data, 'd', 2);

    expect(getTimeRanges(groups)).toEqual([
      { from: '2024-03-10T00:00:00.000Z', to: '2024-03-11T00:00:00.000Z' },
      { from: '2024-03-09T00:00:00.000Z', to: '2024-03-10T00:00:00.000Z' },
    ]);
  });

  it.each([
    { timeWindow: 'h', expected: { from: '2024-03-10T23:00:00.000Z', to: '2024-03-11T23:00:00.000Z' } },
    { timeWindow: 'w', expected: { from: '2024-03-04T00:00:00.000Z', to: '2024-03-05T00:00:00.000Z' } },
    { timeWindow: '12h', expected: { from: '2024-03-10T12:00:00.000Z', to: '2024-03-11T12:00:00.000Z' } },
  ])('shifts the first window by $timeWindow', ({ timeWindow, expected }) => {
    const { panel, data } = setup();

    const groups = createTimeWindowGroups(panel, data, timeWindow, 1);

    expect(getTimeRanges(groups)).toEqual([expected]);
  });

  it('labels each time shifted window with how far back it is shifted', () => {
    const { panel, data } = setup();

    const groups = createTimeWindowGroups(panel, data, 'd', 2);

    expect(groups.map((group) => (group.type === 'timeWindow' ? group.timeShift : null))).toEqual([
      null,
      'Time shifted -1d',
      'Time shifted -2d',
    ]);
  });

  it('keeps the panel title and queries for the time shifted windows', () => {
    const { panel, data } = setup();

    const groups = createTimeWindowGroups(panel, data, 'd', 1);
    const shiftedPanel = getTimeWindowGroups(groups)[0].panel;

    expect(shiftedPanel).not.toBe(panel);
    expect(shiftedPanel.state.title).toBe('Panel A');
    expect(shiftedPanel.state.$data).toBeInstanceOf(SceneQueryRunner);
    expect((shiftedPanel.state.$data as SceneQueryRunner).state.queries).toEqual([{ refId: 'A' }]);
  });
});

function setup() {
  const panel = new VizPanel({
    title: 'Panel A',
    pluginId: 'timeseries',
    $timeRange: new SceneTimeRange({ from: '2024-03-11T00:00:00.000Z', to: '2024-03-12T00:00:00.000Z' }),
    $data: new SceneQueryRunner({ queries: [{ refId: 'A' }] }),
  });

  const data: PanelData = {
    series: [getTestFrame('A-series')],
    state: LoadingState.Done,
    timeRange: getDefaultTimeRange(),
  };

  return { panel, data };
}

function getTimeWindowGroups(groups: ReturnType<typeof createTimeWindowGroups>): TimeWindowSplitGroup[] {
  return groups.filter((group): group is TimeWindowSplitGroup => group.type === 'timeWindow');
}

function getTimeRanges(groups: ReturnType<typeof createTimeWindowGroups>) {
  return getTimeWindowGroups(groups).map((group) => {
    const timeRange = group.panel.getTimeRange();

    return { from: timeRange.from.toISOString(), to: timeRange.to.toISOString() };
  });
}

function getTestFrame(name: string): DataFrame {
  return toDataFrame({
    fields: [
      { name: TIME_SERIES_TIME_FIELD_NAME, values: [1, 2, 3], type: FieldType.time },
      { name, values: [1, 2, 3], type: FieldType.number },
    ],
  });
}
