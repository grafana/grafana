import { sceneGraph } from '@grafana/scenes';

import type { DashboardControls } from '../../scene/DashboardControls';
import type { DashboardScene } from '../../scene/DashboardScene';

import { updateDashboardSettingsCommand } from './updateDashboardSettings';

jest.mock('@grafana/scenes', () => ({
  sceneGraph: {
    getTimeRange: jest.fn(),
  },
}));

function buildTestScene(
  overrides: Partial<{
    title: string;
    description: string;
    tags: string[];
    editable: boolean;
    isEditing: boolean;
  }> = {}
) {
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

  const state: Record<string, unknown> = {
    title: 'Test Dashboard',
    description: '',
    tags: [],
    editable: true,
    isEditing: false,
    $timeRange: timeRange,
    controls,
    ...overrides,
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

  return { scene: scene as unknown as DashboardScene, timeRange, refreshPicker };
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

  it('updates refresh interval', async () => {
    const { scene, refreshPicker } = buildTestScene();
    const result = await updateDashboardSettingsCommand.handler({ refresh: '5m' }, { scene });

    expect(result.success).toBe(true);
    expect(refreshPicker.setState).toHaveBeenCalledWith({ refresh: '5m' });
    expect(result.data).toMatchObject({ refresh: '5m' });
  });

  it('disables refresh with empty string', async () => {
    const { scene, refreshPicker } = buildTestScene();
    refreshPicker.state.refresh = '1m';

    const result = await updateDashboardSettingsCommand.handler({ refresh: '' }, { scene });

    expect(result.success).toBe(true);
    expect(refreshPicker.setState).toHaveBeenCalledWith({ refresh: '' });
    expect(result.data).toMatchObject({ refresh: '' });
  });

  it('updates time range', async () => {
    const { scene, timeRange } = buildTestScene();
    const result = await updateDashboardSettingsCommand.handler(
      { timeRange: { from: 'now-1h', to: 'now' } },
      { scene }
    );

    expect(result.success).toBe(true);
    expect(timeRange.setState).toHaveBeenCalledWith({ from: 'now-1h', to: 'now' });
    expect(result.data).toMatchObject({ timeRange: { from: 'now-1h', to: 'now' } });
  });

  it('updates timezone', async () => {
    const { scene, timeRange } = buildTestScene();
    const result = await updateDashboardSettingsCommand.handler({ timezone: 'utc' }, { scene });

    expect(result.success).toBe(true);
    expect(timeRange.setState).toHaveBeenCalledWith({ timeZone: 'utc' });
    expect(result.data).toMatchObject({ timezone: 'utc' });
  });

  it('updates timezone with IANA string', async () => {
    const { scene, timeRange } = buildTestScene();
    const result = await updateDashboardSettingsCommand.handler({ timezone: 'America/New_York' }, { scene });

    expect(result.success).toBe(true);
    expect(timeRange.setState).toHaveBeenCalledWith({ timeZone: 'America/New_York' });
    expect(result.data).toMatchObject({ timezone: 'America/New_York' });
  });

  it('applies multiple settings at once', async () => {
    const { scene, timeRange, refreshPicker } = buildTestScene();
    const result = await updateDashboardSettingsCommand.handler(
      {
        title: 'Sales Overview',
        tags: ['sales'],
        refresh: '5m',
        timeRange: { from: 'now-24h', to: 'now' },
        timezone: 'utc',
      },
      { scene }
    );

    expect(result.success).toBe(true);
    expect(scene.setState).toHaveBeenCalledWith({ title: 'Sales Overview', tags: ['sales'] });
    expect(timeRange.setState).toHaveBeenCalledWith({ from: 'now-24h', to: 'now', timeZone: 'utc' });
    expect(refreshPicker.setState).toHaveBeenCalledWith({ refresh: '5m' });
  });

  it('warns when refresh is requested but refreshPicker is not present', async () => {
    const { scene } = buildTestScene();
    // Remove refreshPicker from scene controls
    (scene.state as unknown as Record<string, unknown>).controls = undefined;

    const result = await updateDashboardSettingsCommand.handler({ refresh: '5m' }, { scene });

    expect(result.success).toBe(true);
    expect(result.warnings).toContain('refresh interval could not be set: refresh picker not found in scene controls');
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
