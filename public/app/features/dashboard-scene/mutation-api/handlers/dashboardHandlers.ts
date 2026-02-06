/**
 * Dashboard settings mutation handlers
 */

import { sceneGraph, SceneRefreshPicker } from '@grafana/scenes';
import type { TimeSettingsSpec } from '@grafana/schema/src/schema/dashboard/v2beta1/types.spec.gen';

import type { MutationChange, UpdateDashboardMetaPayload } from '../types';

import { createHandler } from '.';

/**
 * Update dashboard time settings.
 *
 * Maps TimeSettingsSpec fields to the correct scene objects:
 * - from/to/timezone -> SceneTimeRange
 * - autoRefresh -> SceneRefreshPicker
 */
export const handleUpdateTimeSettings = createHandler<Partial<TimeSettingsSpec>>(async (payload, context) => {
  const { scene, transaction } = context;
  const { from, to, timezone, autoRefresh } = payload;

  try {
    const timeRange = scene.state.$timeRange;
    if (!timeRange) {
      throw new Error('Dashboard has no time range');
    }

    const previousTimeState = {
      from: timeRange.state.from,
      to: timeRange.state.to,
      timezone: timeRange.state.timeZone,
    };

    const timeRangeUpdates: Record<string, unknown> = {};
    if (from !== undefined) {
      timeRangeUpdates.from = from;
    }
    if (to !== undefined) {
      timeRangeUpdates.to = to;
    }
    if (timezone !== undefined) {
      timeRangeUpdates.timeZone = timezone;
    }

    if (Object.keys(timeRangeUpdates).length > 0) {
      timeRange.setState(timeRangeUpdates);
    }

    let previousAutoRefresh: string | undefined;
    if (autoRefresh !== undefined) {
      try {
        const refreshPicker = sceneGraph.findObject(scene, (obj) => obj instanceof SceneRefreshPicker);
        if (refreshPicker && refreshPicker instanceof SceneRefreshPicker) {
          previousAutoRefresh = refreshPicker.state.refresh;
          refreshPicker.setState({ refresh: autoRefresh });
        }
      } catch {
        // SceneRefreshPicker may not exist on all dashboards
      }
    }

    const inversePreviousState: Partial<TimeSettingsSpec> = {};
    if (from !== undefined) {
      inversePreviousState.from = previousTimeState.from;
    }
    if (to !== undefined) {
      inversePreviousState.to = previousTimeState.to;
    }
    if (timezone !== undefined) {
      inversePreviousState.timezone = previousTimeState.timezone;
    }
    if (autoRefresh !== undefined) {
      inversePreviousState.autoRefresh = previousAutoRefresh;
    }

    const changes: MutationChange[] = [
      { path: '/timeSettings', previousValue: inversePreviousState, newValue: payload },
    ];
    transaction.changes.push(...changes);

    return {
      success: true,
      inverseMutation: {
        type: 'UPDATE_TIME_SETTINGS',
        payload: inversePreviousState,
      },
      changes,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      changes: [],
    };
  }
});

/**
 * Update dashboard metadata (title, description, tags, etc.)
 */
export const handleUpdateDashboardMeta = createHandler<UpdateDashboardMetaPayload>(async (payload, context) => {
  const { scene, transaction } = context;
  const { title, description, tags, editable } = payload;

  try {
    const previousState: UpdateDashboardMetaPayload = {
      title: scene.state.title,
      description: scene.state.description,
      tags: scene.state.tags,
      editable: scene.state.editable,
    };

    const updates: Partial<UpdateDashboardMetaPayload> = {};
    if (title !== undefined) {
      updates.title = title;
    }
    if (description !== undefined) {
      updates.description = description;
    }
    if (tags !== undefined) {
      updates.tags = tags;
    }
    if (editable !== undefined) {
      updates.editable = editable;
    }

    scene.setState(updates);

    const changes: MutationChange[] = [{ path: '/meta', previousValue: previousState, newValue: updates }];
    transaction.changes.push(...changes);

    return {
      success: true,
      inverseMutation: {
        type: 'UPDATE_DASHBOARD_META',
        payload: previousState,
      },
      changes,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      changes: [],
    };
  }
});

/**
 * Get dashboard info (read-only operation).
 * Filters availableCommands to only include implemented commands.
 */
export const handleGetDashboardInfo = createHandler<Record<string, never>>(async (_payload, context) => {
  const { scene } = context;

  const { DASHBOARD_COMMAND_SCHEMAS } = await import('../commandSchemas');

  const info = {
    available: true,
    uid: scene.state.uid,
    title: scene.state.title,
    canEdit: scene.canEditDashboard(),
    isEditing: scene.state.isEditing ?? false,
    availableCommands: DASHBOARD_COMMAND_SCHEMAS.map((cmd) => cmd.name),
  };

  return {
    success: true,
    changes: [],
    data: info,
  };
});

/**
 * Enter edit mode.
 */
export const handleEnterEditMode = createHandler<Record<string, never>>(async (_payload, context) => {
  const { scene, transaction } = context;

  try {
    const wasEditing = scene.state.isEditing ?? false;

    if (!wasEditing) {
      scene.onEnterEditMode();
    }

    const changes: MutationChange[] = [
      {
        path: '/isEditing',
        previousValue: wasEditing,
        newValue: true,
      },
    ];
    transaction.changes.push(...changes);

    return {
      success: true,
      changes,
      data: {
        wasAlreadyEditing: wasEditing,
        isEditing: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      changes: [],
    };
  }
});
