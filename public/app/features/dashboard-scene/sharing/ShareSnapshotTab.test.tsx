import { SceneTimeRange } from '@grafana/scenes';
import { type notifyApp } from 'app/core/reducers/appNotification';
import {
  getDashboardSnapshotSrv,
  type DashboardSnapshotSrv,
  type SnapshotCreateResponse,
} from 'app/features/dashboard/services/SnapshotSrv';
import { dispatch } from 'app/store/store';
import { type AppNotification, AppNotificationSeverity } from 'app/types/appNotifications';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { DashboardInteractions } from '../utils/interactions';

import {
  formatSnapshotSize,
  getExpireOptions,
  getSnapshotPayloadSizeBytes,
  ShareSnapshotTab,
} from './ShareSnapshotTab';

jest.mock('app/features/dashboard/services/SnapshotSrv', () => ({
  getDashboardSnapshotSrv: jest.fn(),
}));

jest.mock('app/store/store', () => ({
  ...jest.requireActual('app/store/store'),
  dispatch: jest.fn(),
}));

const SNAPSHOT_SHARE_CONFIGURATION = 'grafana.dashboard.snapshot.shareConfiguration';

const ONE_HOUR = 60 * 60;
const ONE_WEEK = 60 * 60 * 24 * 7;

let createSnapshot: jest.Mock<Promise<SnapshotCreateResponse>>;

describe('ShareSnapshotTab', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
    createSnapshot = jest.fn().mockResolvedValue({ key: 'abc', url: '/dashboard/snapshot/abc', deleteUrl: '' });
    jest.mocked(getDashboardSnapshotSrv).mockReturnValue(buildSnapshotSrv(createSnapshot));
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

  describe('getSnapshotPayloadSizeBytes', () => {
    // The request sends UTF-8, so a `.length` measurement would undercount every non-ASCII
    // series name or label value embedded in the snapshot data.
    it.each([
      { desc: 'ASCII only', payload: { a: 'b' }, expected: 9 },
      { desc: 'a two-byte character', payload: { a: 'é' }, expected: 10 },
      { desc: 'a four-byte character', payload: { a: '😀' }, expected: 12 },
    ])('measures $desc as $expected bytes', ({ payload, expected }) => {
      expect(getSnapshotPayloadSizeBytes(payload)).toBe(expected);
    });
  });

  describe('formatSnapshotSize', () => {
    // Rounded up, so a payload fractionally over the limit never renders as equal to the limit
    // the same message quotes — the limit itself renders as "16.0 MiB".
    it.each([
      { desc: 'a payload exactly at the 16 MiB limit', bytes: 16 * 1024 * 1024, expected: '16.0 MiB' },
      { desc: 'a payload one byte over the limit', bytes: 16 * 1024 * 1024 + 1, expected: '16.1 MiB' },
      { desc: 'a payload below one kibibyte', bytes: 341, expected: '341.0 B' },
    ])('renders $desc as $expected', ({ bytes, expected }) => {
      expect(formatSnapshotSize(bytes)).toBe(expected);
    });
  });

  describe('payload size guard', () => {
    it('publishes the snapshot when the payload is under the limit', async () => {
      const reportInteraction = jest.spyOn(DashboardInteractions, 'publishSnapshotLocalClicked');
      const tab = parentToScene((scene) => new ShareSnapshotTab({ dashboardRef: scene.getRef() }));

      const response = await tab.onSnapshotCreate();

      expect(response).toEqual({ key: 'abc', url: '/dashboard/snapshot/abc', deleteUrl: '' });
      expect(createSnapshot).toHaveBeenCalledTimes(1);
      expect(createSnapshot.mock.calls[0][0]).toMatchObject({
        name: 'my dashboard',
        expires: ONE_WEEK,
        external: false,
      });
      expect(reportInteraction).toHaveBeenCalledWith({ expires: ONE_WEEK, shareResource: 'dashboard' });
    });

    it('still reports the publish interaction when the payload is over the limit', async () => {
      const reportInteraction = jest.spyOn(DashboardInteractions, 'publishSnapshotLocalClicked');
      const tab = parentToScene((scene) => new TinyLimitShareSnapshotTab({ dashboardRef: scene.getRef() }));

      await expect(tab.onSnapshotCreate()).rejects.toThrow();

      expect(reportInteraction).toHaveBeenCalledWith({ expires: ONE_WEEK, shareResource: 'dashboard' });
    });

    it('rejects without posting when the payload is over the limit', async () => {
      const tab = parentToScene((scene) => new TinyLimitShareSnapshotTab({ dashboardRef: scene.getRef() }));

      // the limit is rendered from maxPayloadSizeBytes, which the subclass sets to 10
      await expect(tab.onSnapshotCreate()).rejects.toThrow('over the 10.0 B limit');

      expect(createSnapshot).not.toHaveBeenCalled();
    });

    it('notifies the user with a way to shrink the snapshot when the payload is over the limit', async () => {
      const tab = parentToScene((scene) => new TinyLimitShareSnapshotTab({ dashboardRef: scene.getRef() }));

      await expect(tab.onSnapshotCreate()).rejects.toThrow();

      const notification = getDispatchedNotification();
      expect(notification.severity).toBe(AppNotificationSeverity.Error);
      expect(notification.title).toBe('Snapshot is too large to publish');
      expect(notification.text).toContain('Snapshot a single panel, shorten the time range');
    });
  });
});

// Exercises the guard without serializing a payload over the real 16 MiB limit
class TinyLimitShareSnapshotTab extends ShareSnapshotTab {
  protected override maxPayloadSizeBytes = 10;
}

function buildSnapshotSrv(create: jest.Mock<Promise<SnapshotCreateResponse>>): DashboardSnapshotSrv {
  return {
    create,
    getSnapshots: jest.fn(),
    getSharingOptions: jest.fn().mockResolvedValue({}),
    deleteSnapshot: jest.fn(),
    getSnapshot: jest.fn(),
  };
}

function getDispatchedNotification(): AppNotification {
  const [action] = jest.mocked(dispatch).mock.calls[0];
  // dispatch is typed over the whole action union; these tests only ever dispatch notifyApp
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return (action as ReturnType<typeof notifyApp>).payload;
}

function buildScene() {
  return new DashboardScene({
    title: 'my dashboard',
    uid: 'dash-1',
    meta: { canEdit: true },
    $timeRange: new SceneTimeRange({}),
    body: DefaultGridLayoutManager.fromVizPanels([]),
  });
}

function buildSnapshotTab() {
  return new ShareSnapshotTab({ dashboardRef: buildScene().getRef() });
}

// onSnapshotCreate resolves the time range through the scene graph, so the tab needs a parent
function parentToScene<T extends ShareSnapshotTab>(build: (scene: DashboardScene) => T): T {
  const scene = buildScene();
  const tab = build(scene);
  scene.setState({ overlay: tab });

  return tab;
}

function readStoredConfiguration(): { expirationTime: number } | undefined {
  const stored = window.localStorage.getItem(SNAPSHOT_SHARE_CONFIGURATION);
  return stored ? JSON.parse(stored) : undefined;
}

function seedStoredConfiguration(config: { expirationTime: number }) {
  window.localStorage.setItem(SNAPSHOT_SHARE_CONFIGURATION, JSON.stringify(config));
}
