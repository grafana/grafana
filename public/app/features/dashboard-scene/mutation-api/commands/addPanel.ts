/**
 * ADD_PANEL command
 *
 * Create a new panel and add it to the dashboard layout.
 * The panel ID is auto-assigned. The layout item kind is adapted
 * to match the target layout (warning emitted if converted).
 */

import { z } from 'zod';

import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { buildVizPanel, getElements } from '../../serialization/layoutSerializers/utils';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getVizPanelKeyForPanelId } from '../../utils/utils';

import { resolveLayoutPath } from './layoutPathResolver';
import { serializeResultLayoutItem } from './movePanel';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';

export const addPanelPayloadSchema = payloads.addPanel;

export type AddPanelPayload = z.infer<typeof addPanelPayloadSchema>;

export const addPanelCommand: MutationCommand<AddPanelPayload> = {
  name: 'ADD_PANEL',
  description: payloads.addPanel.description ?? '',

  payloadSchema: payloads.addPanel,
  permission: requiresEdit,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { panel, parentPath, layoutItem } = payload;
      const warnings: string[] = [];

      const panelId = dashboardSceneGraph.getNextPanelId(scene.state.body);
      const panelSpec = {
        ...panel,
        spec: {
          ...panel.spec,
          id: panelId,
        },
      };

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const vizPanel = buildVizPanel(panelSpec as unknown as Parameters<typeof buildVizPanel>[0], panelId);
      vizPanel.setState({ key: getVizPanelKeyForPanelId(panelId) });

      const resolved = resolveLayoutPath(scene.state.body, parentPath ?? '/');
      const targetLayout = resolved.layoutManager;

      targetLayout.addPanel(vizPanel);

      const isAutoGrid = targetLayout instanceof AutoGridLayoutManager;
      const isDefaultGrid = targetLayout instanceof DefaultGridLayoutManager;

      if (layoutItem) {
        if (layoutItem.kind === 'GridLayoutItem' && isAutoGrid) {
          warnings.push(
            'layoutItem adapted from GridLayoutItem to AutoGridLayoutItem: target uses AutoGridLayout which auto-arranges panels.'
          );
        } else if (layoutItem.kind === 'AutoGridLayoutItem' && isDefaultGrid) {
          warnings.push(
            'layoutItem adapted from AutoGridLayoutItem to GridLayoutItem: target uses GridLayout which requires explicit positioning.'
          );
        }

        const spec = layoutItem.spec;
        if (isDefaultGrid && spec) {
          const gridItem = vizPanel.parent;
          if (gridItem instanceof DashboardGridItem) {
            const updates: Record<string, number> = {};
            if (spec.x !== undefined) {
              updates.x = spec.x;
            }
            if (spec.y !== undefined) {
              updates.y = spec.y;
            }
            if (spec.width !== undefined) {
              updates.width = spec.width;
            }
            if (spec.height !== undefined) {
              updates.height = spec.height;
            }
            if (Object.keys(updates).length > 0) {
              gridItem.setState(updates);
            }
          }
        }
      }

      const elementName = scene.serializer.getElementIdForPanel(panelId) ?? `panel-${panelId}`;
      const resultLayoutItem = serializeResultLayoutItem(vizPanel, elementName);
      const fullElements = getElements(scene.state.body, scene);
      const element = fullElements[elementName];

      return {
        success: true,
        data: { element, layoutItem: resultLayoutItem },
        changes: [{ path: `/elements/${elementName}`, previousValue: null, newValue: element }],
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
