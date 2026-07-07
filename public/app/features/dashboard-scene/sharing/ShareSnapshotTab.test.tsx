import { SceneTimeRange } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { getExpireOptions, ShareSnapshotTab } from './ShareSnapshotTab';

const SNAPSHOT_SHARE_CONFIGURATION = 'grafana.dashboard.snapshot.shareConfiguration';

const ONE_HOUR = 60 * 60;
const ONE_WEEK = 60 * 60 * 24 * 7;

describe('ShareSnapshotTab', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('expire option persistence', () => {
    it('defaults to "1 Week" when nothing is stored', () => {
      const tab = buildSnapshotTab();

      expect(tab.state.selectedExpireOption.value).toBe(ONE_WEEK);
    });

    it('persists the selected expire option to local storage on change', () => {
      const tab = buildSnapshotTab();

      tab.onExpireChange(ONE_HOUR);

      expect(tab.state.selectedExpireOption?.value).toBe(ONE_HOUR);
      expect(readStoredConfiguration()).toEqual({ expirationTime: ONE_HOUR });
    });

    it('persists the "Never" (0) option', () => {
      const tab = buildSnapshotTab();

      tab.onExpireChange(0);

      expect(tab.state.selectedExpireOption?.value).toBe(0);
      expect(readStoredConfiguration()).toEqual({ expirationTime: 0 });
    });

    it('pre-populates the expire option from local storage when opened', () => {
      seedStoredConfiguration({ expirationTime: ONE_HOUR });

      const tab = buildSnapshotTab();

      expect(tab.state.selectedExpireOption.value).toBe(ONE_HOUR);
    });

    it('falls back to the default when the stored value is not a valid option', () => {
      seedStoredConfiguration({ expirationTime: 12345 });

      const tab = buildSnapshotTab();

      expect(tab.state.selectedExpireOption.value).toBe(ONE_WEEK);
    });

    it('does not store anything until the user changes the option', () => {
      buildSnapshotTab();

      expect(readStoredConfiguration()).toBeUndefined();
    });

    it('only stores known expire option values', () => {
      const tab = buildSnapshotTab();
      const validValues = getExpireOptions().map((o) => o.value);

      tab.onExpireChange(ONE_HOUR);

      expect(validValues).toContain(readStoredConfiguration()?.expirationTime);
    });
  });
});

function buildSnapshotTab() {
  const scene = new DashboardScene({
    title: 'my dashboard',
    uid: 'dash-1',
    meta: { canEdit: true },
    $timeRange: new SceneTimeRange({}),
    body: DefaultGridLayoutManager.fromVizPanels([]),
  });

  return new ShareSnapshotTab({ dashboardRef: scene.getRef() });
}

function readStoredConfiguration(): { expirationTime: number } | undefined {
  const stored = window.localStorage.getItem(SNAPSHOT_SHARE_CONFIGURATION);
  return stored ? JSON.parse(stored) : undefined;
}

function seedStoredConfiguration(config: { expirationTime: number }) {
  window.localStorage.setItem(SNAPSHOT_SHARE_CONFIGURATION, JSON.stringify(config));
}
