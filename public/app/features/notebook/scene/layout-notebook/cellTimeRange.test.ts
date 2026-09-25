import { rangeUtil } from '@grafana/data';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { buildVizPanelState } from 'app/features/dashboard-scene/serialization/layoutSerializers/utils';
import { defaultVisualizationPanelKind } from 'app/features/notebook/types';

import { NotebookScene } from '../NotebookScene';

import { NotebookCellItem } from './NotebookCellItem';
import { NotebookLayoutManager } from './NotebookLayoutManager';
import { buildCellSceneTimeRange } from './cellTimeRange';

// A day-rounded ("now/d") preset lands on a different calendar day depending on the timezone it's
// evaluated in. Pacific/Kiritimati (UTC+14) is chosen specifically because it's already the next
// calendar day while it's still the previous one in UTC, at this fixed moment — so the two zones are
// guaranteed to disagree, making a wrong-zone bug impossible to pass by accident.
const ANCESTOR_TIME_ZONE = 'Pacific/Kiritimati';
const NOW = '2024-01-01T20:00:00Z';

function buildActivatedCell(timeZone: string) {
  const panel = new VizPanel(buildVizPanelState(defaultVisualizationPanelKind(), 1));
  const cell = new NotebookCellItem({ elementName: 'panel-1', source: 'user', body: panel });
  const scene = new NotebookScene({
    title: 'Test notebook',
    body: new NotebookLayoutManager({ cells: [cell] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now', timeZone }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });
  const deactivate = cell.activate();
  return { cell, scene, deactivate };
}

describe('buildCellSceneTimeRange', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // The bug this guards against: a plain SceneTimeRange with no explicit timeZone of its own
  // resolves `value` via the browser's default zone, not the ancestor's, even though getTimeZone()
  // itself correctly walks up to it — so a day-rounded preset would land on the wrong calendar day
  // whenever the notebook's configured zone differs from the test/browser default (UTC here).
  it("resolves a day-rounded relative range using the ancestor's timezone, not the default one", () => {
    const { cell, deactivate } = buildActivatedCell(ANCESTOR_TIME_ZONE);

    // setState while already active synchronously activates the newly-assigned $timeRange too,
    // same as the real setCellTimeRange production path.
    cell.setState({ $timeRange: buildCellSceneTimeRange('now/d', 'now/d') });

    const correct = rangeUtil.convertRawToRange({ from: 'now/d', to: 'now/d' }, ANCESTOR_TIME_ZONE);
    const wrong = rangeUtil.convertRawToRange({ from: 'now/d', to: 'now/d' }, 'utc');

    // Sanity check the fixture: if these matched, the test couldn't tell a fix from a regression.
    expect(correct.from.toISOString()).not.toBe(wrong.from.toISOString());

    expect(cell.state.$timeRange?.state.value.from.toISOString()).toBe(correct.from.toISOString());
    expect(cell.state.$timeRange?.state.value.to.toISOString()).toBe(correct.to.toISOString());

    deactivate();
  });

  it("still resolves getTimeZone() to the ancestor's timezone", () => {
    const { cell, deactivate } = buildActivatedCell(ANCESTOR_TIME_ZONE);

    cell.setState({ $timeRange: buildCellSceneTimeRange('now-1h', 'now') });

    expect(cell.state.$timeRange?.getTimeZone()).toBe(ANCESTOR_TIME_ZONE);

    deactivate();
  });

  it('commits a picked range locally instead of forwarding it to the ancestor', () => {
    const { cell, scene, deactivate } = buildActivatedCell(ANCESTOR_TIME_ZONE);
    cell.setState({ $timeRange: buildCellSceneTimeRange('now-1h', 'now') });
    const ancestorFromBefore = scene.state.$timeRange.state.from;

    cell.state.$timeRange?.onTimeRangeChange(
      rangeUtil.convertRawToRange({ from: 'now-24h', to: 'now' }, ANCESTOR_TIME_ZONE)
    );

    expect(cell.state.$timeRange?.state.from).toBe('now-24h');
    // The notebook's own ambient range is untouched.
    expect(scene.state.$timeRange.state.from).toBe(ancestorFromBefore);

    deactivate();
  });

  it('re-evaluates a relative cell override when an absolute notebook range is refreshed', () => {
    const { cell, scene, deactivate } = buildActivatedCell(ANCESTOR_TIME_ZONE);
    scene.state.$timeRange.onTimeRangeChange(
      rangeUtil.convertRawToRange(
        { from: '2024-01-01T10:00:00.000Z', to: '2024-01-01T12:00:00.000Z' },
        ANCESTOR_TIME_ZONE
      )
    );
    cell.setState({ $timeRange: buildCellSceneTimeRange('now-24h', 'now') });

    jest.setSystemTime(new Date('2024-01-01T21:00:00Z'));
    scene.state.$timeRange.onRefresh();

    // 2024-01-01T21:00:00.000Z, and 24h before that.
    expect(cell.state.$timeRange?.state.value.to.valueOf()).toBe(1704142800000);
    expect(cell.state.$timeRange?.state.value.from.valueOf()).toBe(1704056400000);

    deactivate();
  });
});
