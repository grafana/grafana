/**
 * ADD_PANEL command
 *
 * Add a new panel to the dashboard. The panel can be placed at a specific
 * layout path (row/tab) and optionally given an explicit grid position.
 */

import { z } from 'zod';

import type { PanelKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { buildVizPanel } from '../../serialization/layoutSerializers/utils';
import * as dashboardSceneGraph from '../../utils/dashboardSceneGraph';
import { getVizPanelKeyForPanelId } from '../../utils/utils';

import { resolveLayoutPath } from './layoutPathResolver';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

export const addPanelPayloadSchema = payloads.addPanel;

export type AddPanelPayload = z.infer<typeof addPanelPayloadSchema>;

export const addPanelCommand: MutationCommand<AddPanelPayload> = {
  name: 'ADD_PANEL',
  description: payloads.addPanel.description ?? '',

  payloadSchema: payloads.addPanel,
  permission: requiresNewDashboardLayouts,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { panel: panelSpec, parentPath, position } = payload;

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- safe: mutation system only runs inside DashboardScene
      const dashScene = scene as unknown as DashboardScene;

      // Generate a new panel ID
      const panelId = dashboardSceneGraph.getNextPanelId(dashScene);

      // Build the PanelKind structure expected by buildVizPanel.
      // The Zod schema already uses PanelQueryKind shape; we cast because
      // the Zod output types don't exactly match the generated TS interfaces.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod output is structurally compatible with PanelKind
      const panelKind = {
        kind: 'Panel',
        spec: {
          id: panelId,
          title: panelSpec.title ?? '',
          description: panelSpec.description ?? '',
          links: panelSpec.links ?? [],
          transparent: panelSpec.transparent,
          data: panelSpec.data
            ? {
                kind: 'QueryGroup',
                spec: {
                  queries: panelSpec.data.spec.queries,
                  transformations: panelSpec.data.spec.transformations ?? [],
                  queryOptions: panelSpec.data.spec.queryOptions ?? {},
                },
              }
            : {
                kind: 'QueryGroup',
                spec: {
                  queries: [],
                  transformations: [],
                  queryOptions: {},
                },
              },
          vizConfig: {
            kind: 'VizConfig',
            group: panelSpec.vizConfig.group,
            version: panelSpec.vizConfig.version ?? '',
            spec: {
              options: panelSpec.vizConfig.spec?.options ?? {},
              fieldConfig: {
                defaults: panelSpec.vizConfig.spec?.fieldConfig?.defaults ?? {},
                overrides: panelSpec.vizConfig.spec?.fieldConfig?.overrides ?? [],
              },
            },
          },
        },
      } as unknown as PanelKind;

      // Build the VizPanel scene object
      const vizPanel = buildVizPanel(panelKind, panelId);
      vizPanel.setState({ key: getVizPanelKeyForPanelId(panelId) });

      // Resolve target layout
      const targetResolved = resolveLayoutPath(scene.state.body, parentPath ?? '/');
      const targetLayout = targetResolved.layoutManager;

      // Add to target layout
      targetLayout.addPanel(vizPanel);

      // Apply explicit position if provided and not AutoGridLayout
      const warnings: string[] = [];
      if (position) {
        if (targetLayout instanceof AutoGridLayoutManager) {
          warnings.push('Position ignored: target uses AutoGridLayout which auto-arranges panels.');
        } else {
          const gridItem = vizPanel.parent;
          if (gridItem instanceof DashboardGridItem) {
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
        }
      }

      // Resolve the element name for this panel
      const elementName = dashScene.serializer.getElementIdForPanel(panelId);

      return {
        success: true,
        data: { element: elementName, panelId },
        changes: [
          {
            path: `/elements/${elementName}`,
            previousValue: undefined,
            newValue: { kind: 'Panel', title: panelSpec.title ?? '' },
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
