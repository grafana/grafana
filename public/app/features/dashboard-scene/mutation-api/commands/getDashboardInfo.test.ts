import { behaviors, sceneGraph } from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';

import type { DashboardScene } from '../../scene/DashboardScene';

import { getDashboardInfoCommand } from './getDashboardInfo';

jest.mock('@grafana/scenes', () => {
  class CursorSync {
    public state: { sync: number };
    constructor(state: { sync: number }) {
      this.state = state;
    }
  }
  class LiveNowTimer {
    public state: { enabled: boolean };
    constructor(state: { enabled: boolean }) {
      this.state = state;
    }
    public get isEnabled() {
      return this.state.enabled;
    }
  }
  return {
    sceneGraph: { getTimeRange: jest.fn() },
    behaviors: { CursorSync, LiveNowTimer },
  };
});

function buildTestScene() {
  const timeRange = { state: { from: 'now-12h', to: 'now', timeZone: 'utc' } };
  const refreshPicker = { state: { refresh: '30s' } };
  const cursorSync = new behaviors.CursorSync({ sync: DashboardCursorSync.Crosshair });
  const liveNowTimer = new behaviors.LiveNowTimer({ enabled: true });

  const scene = {
    state: {
      title: 'My Dashboard',
      description: 'desc',
      tags: ['a', 'b'],
      editable: false,
      preload: true,
      links: [{ title: 'Runbook', url: 'https://x' }],
      uid: 'dash-1',
      meta: { folderTitle: 'General', folderUid: 'f1', created: 'c', updated: 'u' },
      $behaviors: [cursorSync, liveNowTimer],
      controls: { state: { refreshPicker } },
    },
  };

  (sceneGraph.getTimeRange as jest.Mock).mockReturnValue(timeRange);

  return { scene: scene as unknown as DashboardScene };
}

describe('GET_DASHBOARD_INFO', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns identity/folder metadata plus all UPDATE_DASHBOARD_SETTINGS fields', async () => {
    const { scene } = buildTestScene();
    const result = await getDashboardInfoCommand.handler({}, { scene });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      // identity + folder
      uid: 'dash-1',
      folderTitle: 'General',
      folderUid: 'f1',
      // settings writable via UPDATE_DASHBOARD_SETTINGS
      title: 'My Dashboard',
      description: 'desc',
      tags: ['a', 'b'],
      editable: false,
      cursorSync: 'Crosshair',
      links: [{ title: 'Runbook', url: 'https://x' }],
      timeSettings: { from: 'now-12h', to: 'now', timezone: 'utc', autoRefresh: '30s' },
      liveNow: true,
      preload: true,
    });
  });
});
