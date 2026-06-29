import { behaviors, sceneGraph } from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';

import type { DashboardControls } from '../../scene/DashboardControls';
import type { DashboardScene } from '../../scene/DashboardScene';

import { updateDashboardSettingsCommand } from './updateDashboardSettings';

jest.mock('@grafana/scenes', () => {
  class CursorSync {
    public state: { sync: number };
    constructor(state: { sync: number }) {
      this.state = state;
    }
    public setState = jest.fn((partial: Record<string, unknown>) => {
      Object.assign(this.state, partial);
    });
  }
  class LiveNowTimer {
    public state: { enabled: boolean };
    constructor(state: { enabled: boolean }) {
      this.state = state;
    }
    public get isEnabled() {
      return this.state.enabled;
    }
    public setState = jest.fn((partial: Record<string, unknown>) => {
      Object.assign(this.state, partial);
    });
  }
  return {
    sceneGraph: {
      getTimeRange: jest.fn(),
    },
    behaviors: { CursorSync, LiveNowTimer },
  };
});

function buildTestScene(
  overrides: Partial<{
    title: string;
    description: string;
    tags: string[];
    editable: boolean;
    preload: boolean;
    isEditing: boolean;
    links: unknown[];
    withCursorSync: boolean;
    withLiveNow: boolean;
  }> = {}
) {
  const { withCursorSync = true, withLiveNow = true, links: linksOverride, ...stateOverrides } = overrides;
  const timeRangeState: Record<string, unknown> = {
    from: 'now-6h',
    to: 'now',
    timeZone: '',
  };

  const timeRange = {
    state: timeRangeState,
    setState: jest.fn((partial: Record<string, unknown>) => {
      Object.assign(timeRangeState, partial);
    }),
  };

  const refreshPickerState: Record<string, unknown> = { refresh: '' };
  const refreshPicker = {
    state: refreshPickerState,
    setState: jest.fn((partial: Record<string, unknown>) => {
      Object.assign(refreshPickerState, partial);
    }),
  };

  const controlsState = { refreshPicker };
  const controls = { state: controlsState } as unknown as DashboardControls;

  const cursorSync = new behaviors.CursorSync({ sync: DashboardCursorSync.Off });
  const liveNowTimer = new behaviors.LiveNowTimer({ enabled: false });

  const state: Record<string, unknown> = {
    title: 'Test Dashboard',
    description: '',
    tags: [],
    editable: true,
    preload: false,
    isEditing: false,
    $timeRange: timeRange,
    controls,
    links: linksOverride ?? [],
    $behaviors: [...(withCursorSync ? [cursorSync] : []), ...(withLiveNow ? [liveNowTimer] : [])],
    ...stateOverrides,
  };

  const scene = {
    state,
    canEditDashboard: jest.fn(() => true),
    onEnterEditMode: jest.fn(() => {
      state.isEditing = true;
    }),
    forceRender: jest.fn(),
    setState: jest.fn((partial: Record<string, unknown>) => {
      Object.assign(state, partial);
    }),
  };

  (sceneGraph.getTimeRange as jest.Mock).mockReturnValue(timeRange);

  return { scene: scene as unknown as DashboardScene, timeRange, refreshPicker, cursorSync, liveNowTimer };
}

describe('UPDATE_DASHBOARD_SETTINGS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates title only', async () => {
    const { scene } = buildTestScene();
    const result = await updateDashboardSettingsCommand.handler({ title: 'New Title' }, { scene });

    expect(result.success).toBe(true);
    expect(scene.setState).toHaveBeenCalledWith({ title: 'New Title' });
    expect(result.data).toMatchObject({ title: 'New Title' });
    expect(result.changes[0].previousValue).toMatchObject({ title: 'Test Dashboard' });
  });

  it('updates description', async () => {
    const { scene } = buildTestScene();
    const result = await updateDashboardSettingsCommand.handler({ description: 'A great dashboard' }, { scene });

    expect(result.success).toBe(true);
    expect(scene.setState).toHaveBeenCalledWith({ description: 'A great dashboard' });
    expect(result.data).toMatchObject({ description: 'A great dashboard' });
  });

  it('updates tags', async () => {
    const { scene } = buildTestScene({ tags: ['old'] });
    const result = await updateDashboardSettingsCommand.handler({ tags: ['sales', 'ops'] }, { scene });

    expect(result.success).toBe(true);
    expect(scene.setState).toHaveBeenCalledWith({ tags: ['sales', 'ops'] });
    expect(result.data).toMatchObject({ tags: ['sales', 'ops'] });
    expect(result.changes[0].previousValue).toMatchObject({ tags: ['old'] });
  });

  it('updates editable', async () => {
    const { scene } = buildTestScene();
    const result = await updateDashboardSettingsCommand.handler({ editable: false }, { scene });

    expect(result.success).toBe(true);
    expect(scene.setState).toHaveBeenCalledWith({ editable: false });
    expect(result.data).toMatchObject({ editable: false });
  });

  it('updates preload', async () => {
    const { scene } = buildTestScene();
    const result = await updateDashboardSettingsCommand.handler({ preload: true }, { scene });

    expect(result.success).toBe(true);
    expect(scene.setState).toHaveBeenCalledWith({ preload: true });
    expect(result.data).toMatchObject({ preload: true });
  });

  it('updates the auto-refresh interval via timeSettings', async () => {
    const { scene, refreshPicker } = buildTestScene();
    const result = await updateDashboardSettingsCommand.handler({ timeSettings: { autoRefresh: '5m' } }, { scene });

    expect(result.success).toBe(true);
    expect(refreshPicker.setState).toHaveBeenCalledWith({ refresh: '5m' });
    expect(result.data).toMatchObject({ timeSettings: { autoRefresh: '5m' } });
  });

  it('disables auto-refresh with an empty string', async () => {
    const { scene, refreshPicker } = buildTestScene();
    refreshPicker.state.refresh = '1m';

    const result = await updateDashboardSettingsCommand.handler({ timeSettings: { autoRefresh: '' } }, { scene });

    expect(result.success).toBe(true);
    expect(refreshPicker.setState).toHaveBeenCalledWith({ refresh: '' });
    expect(result.data).toMatchObject({ timeSettings: { autoRefresh: '' } });
  });

  it('updates the time range via timeSettings', async () => {
    const { scene, timeRange } = buildTestScene();
    const result = await updateDashboardSettingsCommand.handler(
      { timeSettings: { from: 'now-1h', to: 'now' } },
      { scene }
    );

    expect(result.success).toBe(true);
    expect(timeRange.setState).toHaveBeenCalledWith({ from: 'now-1h', to: 'now' });
    expect(result.data).toMatchObject({ timeSettings: { from: 'now-1h', to: 'now' } });
  });

  it('updates the timezone via timeSettings', async () => {
    const { scene, timeRange } = buildTestScene();
    const result = await updateDashboardSettingsCommand.handler({ timeSettings: { timezone: 'utc' } }, { scene });

    expect(result.success).toBe(true);
    expect(timeRange.setState).toHaveBeenCalledWith({ timeZone: 'utc' });
    expect(result.data).toMatchObject({ timeSettings: { timezone: 'utc' } });
  });

  it('updates the timezone with an IANA string', async () => {
    const { scene, timeRange } = buildTestScene();
    const result = await updateDashboardSettingsCommand.handler(
      { timeSettings: { timezone: 'America/New_York' } },
      { scene }
    );

    expect(result.success).toBe(true);
    expect(timeRange.setState).toHaveBeenCalledWith({ timeZone: 'America/New_York' });
    expect(result.data).toMatchObject({ timeSettings: { timezone: 'America/New_York' } });
  });

  it('updates cursorSync via the CursorSync behavior', async () => {
    const { scene, cursorSync } = buildTestScene();
    const result = await updateDashboardSettingsCommand.handler({ cursorSync: 'Crosshair' }, { scene });

    expect(result.success).toBe(true);
    expect(cursorSync.setState).toHaveBeenCalledWith({ sync: DashboardCursorSync.Crosshair });
    expect(result.data).toMatchObject({ cursorSync: 'Crosshair' });
  });

  it('warns when cursorSync is requested but the CursorSync behavior is missing', async () => {
    const { scene } = buildTestScene({ withCursorSync: false });
    const result = await updateDashboardSettingsCommand.handler({ cursorSync: 'Tooltip' }, { scene });

    expect(result.success).toBe(true);
    expect(result.warnings).toContain('cursorSync could not be set: CursorSync behavior not found in scene');
  });

  it('updates liveNow via the LiveNowTimer behavior', async () => {
    const { scene, liveNowTimer } = buildTestScene();
    const result = await updateDashboardSettingsCommand.handler({ liveNow: true }, { scene });

    expect(result.success).toBe(true);
    expect(liveNowTimer.setState).toHaveBeenCalledWith({ enabled: true });
    expect(result.data).toMatchObject({ liveNow: true });
  });

  it('warns when liveNow is requested but the LiveNowTimer behavior is missing', async () => {
    const { scene } = buildTestScene({ withLiveNow: false });
    const result = await updateDashboardSettingsCommand.handler({ liveNow: true }, { scene });

    expect(result.success).toBe(true);
    expect(result.warnings).toContain('liveNow could not be set: LiveNowTimer behavior not found in scene');
  });

  it('replaces dashboard links and fills the full link shape', async () => {
    const { scene } = buildTestScene();
    const result = await updateDashboardSettingsCommand.handler(
      { links: [{ title: 'Runbook', url: 'https://runbooks.example.com', type: 'link', targetBlank: true }] },
      { scene }
    );

    expect(result.success).toBe(true);
    expect(scene.setState).toHaveBeenCalledWith({
      links: [
        {
          title: 'Runbook',
          url: 'https://runbooks.example.com',
          type: 'link',
          tooltip: '',
          icon: '',
          tags: [],
          asDropdown: false,
          targetBlank: true,
          includeVars: false,
          keepTime: false,
        },
      ],
    });
  });

  it('clears links with an empty array', async () => {
    const { scene } = buildTestScene({ links: [{ title: 'old', url: 'https://x' }] });
    const result = await updateDashboardSettingsCommand.handler({ links: [] }, { scene });

    expect(result.success).toBe(true);
    expect(scene.setState).toHaveBeenCalledWith({ links: [] });
  });

  it('applies multiple settings at once', async () => {
    const { scene, timeRange, refreshPicker } = buildTestScene();
    const result = await updateDashboardSettingsCommand.handler(
      {
        title: 'Sales Overview',
        tags: ['sales'],
        preload: true,
        timeSettings: { from: 'now-24h', to: 'now', timezone: 'utc', autoRefresh: '5m' },
      },
      { scene }
    );

    expect(result.success).toBe(true);
    expect(scene.setState).toHaveBeenCalledWith({ title: 'Sales Overview', tags: ['sales'], preload: true });
    expect(timeRange.setState).toHaveBeenCalledWith({ from: 'now-24h', to: 'now', timeZone: 'utc' });
    expect(refreshPicker.setState).toHaveBeenCalledWith({ refresh: '5m' });
  });

  it('warns when auto-refresh is requested but refreshPicker is not present', async () => {
    const { scene } = buildTestScene();
    // Remove refreshPicker from scene controls
    (scene.state as unknown as Record<string, unknown>).controls = undefined;

    const result = await updateDashboardSettingsCommand.handler({ timeSettings: { autoRefresh: '5m' } }, { scene });

    expect(result.success).toBe(true);
    expect(result.warnings).toContain('autoRefresh could not be set: refresh picker not found in scene controls');
  });

  it('empty payload is a no-op', async () => {
    const { scene, timeRange, refreshPicker } = buildTestScene();
    const result = await updateDashboardSettingsCommand.handler({}, { scene });

    expect(result.success).toBe(true);
    expect(scene.setState).not.toHaveBeenCalled();
    expect(timeRange.setState).not.toHaveBeenCalled();
    expect(refreshPicker.setState).not.toHaveBeenCalled();
  });

  it('enters edit mode if not already editing', async () => {
    const { scene } = buildTestScene({ isEditing: false });
    await updateDashboardSettingsCommand.handler({ title: 'X' }, { scene });

    expect(scene.onEnterEditMode).toHaveBeenCalled();
  });

  it('does not re-enter edit mode if already editing', async () => {
    const { scene } = buildTestScene({ isEditing: true });
    await updateDashboardSettingsCommand.handler({ title: 'X' }, { scene });

    expect(scene.onEnterEditMode).not.toHaveBeenCalled();
  });

  it('records previous and new values in changes', async () => {
    const { scene } = buildTestScene({ title: 'Old Title', description: 'Old Desc' });
    const result = await updateDashboardSettingsCommand.handler(
      { title: 'New Title', description: 'New Desc' },
      { scene }
    );

    expect(result.success).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].previousValue).toMatchObject({ title: 'Old Title', description: 'Old Desc' });
    expect(result.changes[0].newValue).toMatchObject({ title: 'New Title', description: 'New Desc' });
  });
});
