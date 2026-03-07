/**
 * MOVE_PANEL command
 *
 * Move an existing panel to a different group (row/tab) and/or reposition it.
 * The panel is identified by its element name (key in the elements map).
 * The layout item kind is adapted to match the target layout (warning emitted
 * if converted). Supports panels in both DashboardGridItem and AutoGridItem.
 */

import { z } from 'zod';

import type { VizPanel } from '@grafana/scenes';

import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { getElements } from '../../serialization/layoutSerializers/utils';
import { getLayoutManagerFor, getVizPanelKeyForPanelId } from '../../utils/utils';

import { resolveLayoutPath } from './layoutPathResolver';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

export const movePanelPayloadSchema = payloads.movePanel;

export type MovePanelPayload = z.infer<typeof movePanelPayloadSchema>;

function applyGridPosition(
  panel: VizPanel,
  position: { x?: number; y?: number; width?: number; height?: number }
): void {
  const gridItem = panel.parent;
  if (!(gridItem instanceof DashboardGridItem)) {
    return;
  }

  const updates: Record<string, number> = {};
  if (position.x !== undefined) {
    updates.x = position.x;
  }
  if (position.y !== undefined) {
    updates.y = position.y;
  }
  if (position.width !== undefined) {
    updates.width = position.width;
  }
  if (position.height !== undefined) {
    updates.height = position.height;
  }

  if (Object.keys(updates).length > 0) {
    gridItem.setState(updates);
  }
}

function resolveEffectivePosition(
  payload: MovePanelPayload,
  warnings: string[]
): { x?: number; y?: number; width?: number; height?: number } | undefined {
  if (payload.layoutItem) {
    const spec = payload.layoutItem.spec;
    if (
      spec &&
      (spec.x !== undefined || spec.y !== undefined || spec.width !== undefined || spec.height !== undefined)
    ) {
      return spec;
    }
    return undefined;
  }

  if (payload.position) {
    warnings.push(
      'DEPRECATED: "position" will be removed in a future version. ' +
        'Use "layoutItem: { spec: { x, y, width, height } }" instead.'
    );
    return payload.position;
  }

  return undefined;
}

/**
 * Serialize the current layout item for a panel based on its parent type.
 * Includes the v2beta1 element reference so the response is self-describing.
 * Used by ADD_PANEL, MOVE_PANEL, UPDATE_PANEL, and LIST_PANELS.
 */
export function serializeResultLayoutItem(panel: VizPanel, elementName: string) {
  const elementRef = { kind: 'ElementReference' as const, name: elementName };
  const gridItem = panel.parent;
  if (gridItem instanceof DashboardGridItem) {
    return {
      kind: 'GridLayoutItem' as const,
      spec: {
        x: gridItem.state.x ?? 0,
        y: gridItem.state.y ?? 0,
        width: gridItem.state.width ?? 0,
        height: gridItem.state.height ?? 0,
        element: elementRef,
      },
    };
  }

  return { kind: 'AutoGridLayoutItem' as const, spec: { element: elementRef } };
}

function emitLayoutItemKindWarnings(
  layoutItemKind: string | undefined,
  isAutoGrid: boolean,
  isDefaultGrid: boolean,
  warnings: string[]
) {
  if (!layoutItemKind) {
    return;
  }
  if (layoutItemKind === 'GridLayoutItem' && isAutoGrid) {
    warnings.push(
      'layoutItem adapted from GridLayoutItem to AutoGridLayoutItem: target uses AutoGridLayout which auto-arranges panels.'
    );
  } else if (layoutItemKind === 'AutoGridLayoutItem' && isDefaultGrid) {
    warnings.push(
      'layoutItem adapted from AutoGridLayoutItem to GridLayoutItem: target uses GridLayout which requires explicit positioning.'
    );
  }
}

export const movePanelCommand: MutationCommand<MovePanelPayload> = {
  name: 'MOVE_PANEL',
  description: payloads.movePanel.description ?? '',

  payloadSchema: payloads.movePanel,
  permission: requiresNewDashboardLayouts,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { element, toParent } = payload;
      const elementName = element.name;
      const warnings: string[] = [];

      const panelId = scene.serializer.getPanelIdForElement(elementName);
      if (panelId === undefined) {
        throw new Error(`Element "${elementName}" not found in the dashboard`);
      }

      const expectedKey = getVizPanelKeyForPanelId(panelId);
      const allPanels = scene.state.body.getVizPanels();
      const vizPanel = allPanels.find((p) => p.state.key === expectedKey);
      if (!vizPanel) {
        throw new Error(`Panel with ID ${panelId} (element "${elementName}") not found in the layout`);
      }

      const effectivePosition = resolveEffectivePosition(payload, warnings);

      if (!toParent) {
        const currentLayout = getLayoutManagerFor(vizPanel);
        const isAutoGrid = currentLayout instanceof AutoGridLayoutManager;
        const isDefaultGrid = currentLayout instanceof DefaultGridLayoutManager;

        emitLayoutItemKindWarnings(payload.layoutItem?.kind, isAutoGrid, isDefaultGrid, warnings);

        const previousPosition = serializeResultLayoutItem(vizPanel, elementName);

        if (effectivePosition) {
          if (isAutoGrid) {
            warnings.push('Position ignored: current layout uses AutoGridLayout which auto-arranges panels.');
          } else {
            applyGridPosition(vizPanel, effectivePosition);
          }
        }

        const resultLayoutItem = serializeResultLayoutItem(vizPanel, elementName);
        const fullElements = getElements(scene.state.body, scene);
        const elementData = fullElements[elementName];

        return {
          success: true,
          data: { element: elementData, layoutItem: resultLayoutItem },
          changes: effectivePosition
            ? [
                {
                  path: `/elements/${elementName}/position`,
                  previousValue: previousPosition.spec,
                  newValue: effectivePosition,
                },
              ]
            : [],
          warnings: warnings.length > 0 ? warnings : undefined,
        };
      }

      const targetResolved = resolveLayoutPath(scene.state.body, toParent);
      const targetLayout = targetResolved.layoutManager;
      const isTargetAutoGrid = targetLayout instanceof AutoGridLayoutManager;
      const isTargetDefaultGrid = targetLayout instanceof DefaultGridLayoutManager;

      emitLayoutItemKindWarnings(payload.layoutItem?.kind, isTargetAutoGrid, isTargetDefaultGrid, warnings);

      const previousLayoutItem = serializeResultLayoutItem(vizPanel, elementName);

      const sourceGridItem = vizPanel.parent;
      const originalSize =
        sourceGridItem instanceof DashboardGridItem
          ? { width: sourceGridItem.state.width, height: sourceGridItem.state.height }
          : undefined;

      const panelClone = vizPanel.clone();

      const currentLayout = getLayoutManagerFor(vizPanel);
      if (!currentLayout.removePanel) {
        throw new Error('Source layout does not support panel removal');
      }
      currentLayout.removePanel(vizPanel);

      targetLayout.addPanel(panelClone);

      if (effectivePosition) {
        if (isTargetAutoGrid) {
          warnings.push('Position ignored: target uses AutoGridLayout which auto-arranges panels.');
        } else {
          applyGridPosition(panelClone, effectivePosition);
        }
      } else if (originalSize && !isTargetAutoGrid) {
        applyGridPosition(panelClone, originalSize);
      }

      const resultLayoutItem = serializeResultLayoutItem(panelClone, elementName);
      const fullElements = getElements(scene.state.body, scene);
      const elementData = fullElements[elementName];

      return {
        success: true,
        data: { element: elementData, layoutItem: resultLayoutItem },
        changes: [
          {
            path: `/elements/${elementName}`,
            previousValue: previousLayoutItem,
            newValue: { parent: toParent },
          },
        ],
        warnings: warnings.length > 0 ? warnings : undefined,
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
