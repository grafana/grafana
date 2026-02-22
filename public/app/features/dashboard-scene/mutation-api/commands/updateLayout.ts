/**
 * UPDATE_LAYOUT command
 *
 * Updates the layout at a given path. Can switch the layout type
 * (same-category only: group<->group or grid<->grid) and/or update
 * layout-level properties (currently AutoGridLayout options).
 *
 * If layoutType is omitted, keeps the current type and just applies options.
 */

import { z } from 'zod';

import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { DashboardLayoutManager } from '../../scene/types/DashboardLayoutManager';
import { isLayoutParent } from '../../scene/types/LayoutParent';

import { resolveLayoutPath } from './layoutPathResolver';
import { autoGridOptionsSchema, payloads } from './schemas';
import {
  enterEditModeIfNeeded,
  requiresNewDashboardLayouts,
  type MutationCommand,
  type MutationContext,
} from './types';

export const updateLayoutPayloadSchema = payloads.updateLayout;

export type UpdateLayoutPayload = z.infer<typeof updateLayoutPayloadSchema>;

type LayoutType = 'RowsLayout' | 'TabsLayout' | 'GridLayout' | 'AutoGridLayout';
type AutoGridOptions = z.infer<typeof autoGridOptionsSchema>;

const VALID_LAYOUT_TYPES: ReadonlySet<string> = new Set(['RowsLayout', 'TabsLayout', 'GridLayout', 'AutoGridLayout']);
const GROUP_TYPES = new Set<LayoutType>(['RowsLayout', 'TabsLayout']);
const GRID_TYPES = new Set<LayoutType>(['GridLayout', 'AutoGridLayout']);

function isLayoutType(id: string): id is LayoutType {
  return VALID_LAYOUT_TYPES.has(id);
}

function getLayoutTypeId(layout: { descriptor: { id: string } }): LayoutType {
  const id = layout.descriptor.id;
  if (!isLayoutType(id)) {
    throw new Error(`Unknown layout type: ${id}`);
  }
  return id;
}

function isGroupType(t: LayoutType): boolean {
  return GROUP_TYPES.has(t);
}

function sameCategory(a: LayoutType, b: LayoutType): boolean {
  return (GROUP_TYPES.has(a) && GROUP_TYPES.has(b)) || (GRID_TYPES.has(a) && GRID_TYPES.has(b));
}

function pathSegmentType(layoutType: LayoutType): 'rows' | 'tabs' | null {
  if (layoutType === 'RowsLayout') {
    return 'rows';
  }
  if (layoutType === 'TabsLayout') {
    return 'tabs';
  }
  return null;
}

function applyAutoGridOptions(
  layout: DashboardLayoutManager,
  path: string,
  options?: AutoGridOptions
): Array<{ path: string; previousValue: unknown; newValue: unknown }> {
  if (!options || !(layout instanceof AutoGridLayoutManager)) {
    return [];
  }
  const patch: Record<string, unknown> = {};
  if (options.maxColumnCount !== undefined) {
    patch.maxColumnCount = options.maxColumnCount;
  }
  if (options.fillScreen !== undefined) {
    patch.fillScreen = options.fillScreen;
  }
  if (options.columnWidthMode !== undefined) {
    patch.columnWidth = options.columnWidthMode === 'custom' ? (options.columnWidth ?? 400) : options.columnWidthMode;
  }
  if (options.rowHeightMode !== undefined) {
    patch.rowHeight = options.rowHeightMode === 'custom' ? (options.rowHeight ?? 200) : options.rowHeightMode;
  }
  if (Object.keys(patch).length > 0) {
    const stateRecord: Record<string, unknown> = { ...layout.state };
    const prev: Record<string, unknown> = {};
    for (const key of Object.keys(patch)) {
      prev[key] = stateRecord[key];
    }
    layout.setState(patch);
    return [{ path, previousValue: prev, newValue: patch }];
  }
  return [];
}

function validateGroupNesting(path: string, layoutType: LayoutType, currentLayout: DashboardLayoutManager): void {
  const targetSegmentType = pathSegmentType(layoutType);
  if (!targetSegmentType) {
    throw new Error(`Unexpected group layout type: ${layoutType}`);
  }

  const pathParts = path === '/' ? [] : path.slice(1).split('/');
  for (let i = 0; i < pathParts.length; i += 2) {
    if (pathParts[i] === targetSegmentType) {
      throw new Error(
        `Cannot convert to ${layoutType} at "${path}": would create same-type nesting (${targetSegmentType} inside ${targetSegmentType}).`
      );
    }
  }

  if (currentLayout instanceof RowsLayoutManager) {
    for (const row of currentLayout.state.rows) {
      if (
        (layoutType === 'RowsLayout' && row.state.layout instanceof RowsLayoutManager) ||
        (layoutType === 'TabsLayout' && row.state.layout instanceof TabsLayoutManager)
      ) {
        throw new Error(
          `Cannot convert to ${layoutType}: a child's inner layout is already ${layoutType}, which would create same-type nesting.`
        );
      }
    }
  } else if (currentLayout instanceof TabsLayoutManager) {
    for (const tab of currentLayout.state.tabs) {
      if (
        (layoutType === 'RowsLayout' && tab.state.layout instanceof RowsLayoutManager) ||
        (layoutType === 'TabsLayout' && tab.state.layout instanceof TabsLayoutManager)
      ) {
        throw new Error(
          `Cannot convert to ${layoutType}: a child's inner layout is already ${layoutType}, which would create same-type nesting.`
        );
      }
    }
  }
}

function switchLayout(
  resolved: ReturnType<typeof resolveLayoutPath>,
  newLayout: DashboardLayoutManager,
  path: string
): void {
  if (resolved.item) {
    if (!isLayoutParent(resolved.item)) {
      throw new Error(`Cannot switch layout: item at "${path}" is not a LayoutParent`);
    }
    resolved.item.switchLayout(newLayout);
  } else {
    const layoutParent = resolved.layoutManager.parent;
    if (!layoutParent || !isLayoutParent(layoutParent)) {
      throw new Error('Cannot switch layout: parent is not a LayoutParent');
    }
    layoutParent.switchLayout(newLayout);
  }
}

function createNewLayout(layoutType: LayoutType, currentLayout: DashboardLayoutManager): DashboardLayoutManager {
  switch (layoutType) {
    case 'RowsLayout':
      return RowsLayoutManager.createFromLayout(currentLayout);
    case 'TabsLayout':
      return TabsLayoutManager.createFromLayout(currentLayout);
    case 'GridLayout':
      return DefaultGridLayoutManager.createFromLayout(currentLayout);
    case 'AutoGridLayout':
      return AutoGridLayoutManager.createFromLayout(currentLayout);
  }
}

export const updateLayoutCommand: MutationCommand<UpdateLayoutPayload> = {
  name: 'UPDATE_LAYOUT',
  description: payloads.updateLayout.description ?? '',

  payloadSchema: payloads.updateLayout,
  permission: requiresNewDashboardLayouts,

  handler: async (payload, context: MutationContext) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { path, layoutType, options } = payload;
      const resolved = resolveLayoutPath(scene.state.body, path);
      const currentLayout = resolved.layoutManager;
      const currentTypeId = getLayoutTypeId(currentLayout);
      const effectiveType = layoutType ?? currentTypeId;

      if (options && effectiveType !== 'AutoGridLayout') {
        throw new Error(`Options are only valid for AutoGridLayout, but the target layout type is ${effectiveType}.`);
      }

      // No-op: same type and no options
      if (effectiveType === currentTypeId && !options) {
        return { success: true, data: { path, layoutType: currentTypeId }, changes: [] };
      }

      // Update-only mode: same type, just apply options
      if (effectiveType === currentTypeId) {
        const changes = applyAutoGridOptions(currentLayout, path, options);
        return { success: true, data: { path, layoutType: currentTypeId }, changes };
      }

      // Type switch
      if (!sameCategory(currentTypeId, effectiveType)) {
        throw new Error(
          `Cannot convert ${currentTypeId} to ${effectiveType}: only same-category conversions are allowed ` +
            `(group<->group or grid<->grid).`
        );
      }

      if (isGroupType(effectiveType)) {
        validateGroupNesting(path, effectiveType, currentLayout);
      }

      const newLayout = createNewLayout(effectiveType, currentLayout);
      const optionChanges = applyAutoGridOptions(newLayout, path, options);

      switchLayout(resolved, newLayout, path);

      return {
        success: true,
        data: { path, layoutType: effectiveType },
        changes: [{ path, previousValue: currentTypeId, newValue: effectiveType }, ...optionChanges],
        warnings: [
          `Layout at "${path}" converted from ${currentTypeId} to ${effectiveType}. Previous paths may be invalidated; call GET_LAYOUT to refresh.`,
        ],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
