/**
 * Dashboard settings mutation handlers
 */

import type { TimeSettingsSpec } from '@grafana/schema/src/schema/dashboard/v2beta1/types.spec.gen';

import { DASHBOARD_MCP_TOOLS } from '../mcpTools';
import type { MutationResult, MutationChange, UpdateDashboardMetaPayload, AddRowPayload } from '../types';

import type { MutationContext } from './types';

/**
 * Add a row (stub - not fully implemented)
 */
export async function handleAddRow(_payload: AddRowPayload, _context: MutationContext): Promise<MutationResult> {
  return {
    success: true,
    changes: [],
    warnings: ['Add row is not fully implemented in POC - requires RowsLayout'],
  };
}

/**
 * Update dashboard time settings
 */
export async function handleUpdateTimeSettings(
  payload: Partial<TimeSettingsSpec>,
  context: MutationContext
): Promise<MutationResult> {
  const { scene, transaction } = context;
  const { from, to, timezone, autoRefresh } = payload;

  try {
    const timeRange = scene.state.$timeRange;
    if (!timeRange) {
      throw new Error('Dashboard has no time range');
    }

    const previousState = { ...timeRange.state };

    // Apply updates based on TimeSettingsSpec fields
    const updates: Record<string, unknown> = {};
    if (from !== undefined) {
      updates.from = from;
    }
    if (to !== undefined) {
      updates.to = to;
    }
    if (timezone !== undefined) {
      updates.timeZone = timezone;
    }
    if (autoRefresh !== undefined) {
      // autoRefresh would be applied to the dashboard refresh interval
      updates.refreshInterval = autoRefresh;
    }

    timeRange.setState(updates);

    const changes: MutationChange[] = [{ path: '/timeSettings', previousValue: previousState, newValue: updates }];
    transaction.changes.push(...changes);

    return {
      success: true,
      inverseMutation: {
        type: 'UPDATE_TIME_SETTINGS',
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        payload: previousState as Partial<TimeSettingsSpec>,
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
}

/**
 * Update dashboard metadata (title, description, tags, etc.)
 */
export async function handleUpdateDashboardMeta(
  payload: UpdateDashboardMetaPayload,
  context: MutationContext
): Promise<MutationResult> {
  const { scene, transaction } = context;
  const { title, description, tags, editable } = payload;

  try {
    const previousState = {
      title: scene.state.title,
      description: scene.state.description,
      tags: scene.state.tags,
      editable: scene.state.editable,
    };

    // Apply updates
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
}

/**
 * Get dashboard info (read-only operation)
 */
export async function handleGetDashboardInfo(
  _payload: Record<string, never>,
  context: MutationContext
): Promise<MutationResult> {
  const { scene } = context;

  // Return dashboard info in the result's data field
  const info = {
    available: true,
    uid: scene.state.uid,
    title: scene.state.title,
    canEdit: scene.canEditDashboard(),
    isEditing: scene.state.isEditing ?? false,
    availableTools: DASHBOARD_MCP_TOOLS.map((t) => t.name),
  };

  return {
    success: true,
    changes: [],
    data: info,
  };
}
