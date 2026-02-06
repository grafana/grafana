/**
 * Panel mutation handlers
 *
 * Uses existing serialization utilities from layoutSerializers/utils.ts and
 * transformSceneToSaveModelSchemaV2.ts to convert between schema types and scene objects.
 */

import { VizPanel } from '@grafana/scenes';
import { PanelKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { buildVizPanel, createPanelDataProvider } from '../../serialization/layoutSerializers/utils';
import { vizPanelToSchemaV2 } from '../../serialization/transformSceneToSaveModelSchemaV2';
import { transformMappingsToV1 } from '../../serialization/transformToV1TypesUtils';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getVizPanelKeyForPanelId } from '../../utils/utils';
import type { MutationChange, AddPanelPayload, RemovePanelPayload, UpdatePanelPayload } from '../types';

import { createHandler } from '.';

/**
 * Find a panel by elementName or panelId in the dashboard body.
 */
function findPanel(panels: VizPanel[], elementName?: string, panelId?: number): VizPanel | null {
  for (const panel of panels) {
    const state = panel.state;
    if (elementName && state.key === elementName) {
      return panel;
    }
    if (panelId !== undefined && state.key) {
      const keyMatch = String(state.key).match(/^panel-(\d+)$/);
      if (keyMatch && parseInt(keyMatch[1], 10) === panelId) {
        return panel;
      }
    }
  }
  return null;
}

/**
 * Add a new panel to the dashboard.
 *
 * The payload already contains a PanelKind -- we just assign an id and pass it
 * through buildVizPanel from the serialization layer.
 */
export const handleAddPanel = createHandler<AddPanelPayload>(async (payload, context) => {
  const { scene, transaction } = context;

  try {
    const body = scene.state.body;
    if (!body) {
      throw new Error('Dashboard has no body');
    }

    const panelId = dashboardSceneGraph.getNextPanelId(scene);
    const elementName = getVizPanelKeyForPanelId(panelId);

    // The payload is already a PanelKind -- just inject the generated id
    const panelKind: PanelKind = {
      ...payload.panel,
      spec: {
        ...payload.panel.spec,
        id: panelId,
        title: payload.panel.spec.title || 'New Panel',
        description: payload.panel.spec.description ?? '',
        links: payload.panel.spec.links ?? [],
        data: payload.panel.spec.data ?? {
          kind: 'QueryGroup',
          spec: { queries: [], transformations: [], queryOptions: {} },
        },
      },
    };
    const vizPanel = buildVizPanel(panelKind, panelId);

    scene.addPanel(vizPanel);

    const changes: MutationChange[] = [
      {
        path: `/elements/${elementName}`,
        previousValue: undefined,
        newValue: { title: panelKind.spec.title, pluginId: panelKind.spec.vizConfig.group, panelId },
      },
    ];
    transaction.changes.push(...changes);

    return {
      success: true,
      data: { panelId, elementName },
      inverseMutation: {
        type: 'REMOVE_PANEL',
        payload: { elementName, panelId },
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
 * Remove a panel from the dashboard.
 *
 * Captures the full PanelKind before removal for a structurally correct inverse mutation.
 */
export const handleRemovePanel = createHandler<RemovePanelPayload>(async (payload, context) => {
  const { scene, transaction } = context;
  const { elementName, panelId } = payload;

  try {
    const body = scene.state.body;
    if (!body) {
      throw new Error('Dashboard has no body');
    }

    const panels = body.getVizPanels();
    const panelToRemove = findPanel(panels, elementName, panelId);

    if (!panelToRemove) {
      throw new Error(`Panel not found: ${elementName ?? `panelId=${panelId}`}`);
    }

    const panelKind = vizPanelToSchemaV2(panelToRemove);

    scene.removePanel(panelToRemove);

    const changes: MutationChange[] = [
      { path: `/elements/${elementName || panelId}`, previousValue: panelKind, newValue: undefined },
    ];
    transaction.changes.push(...changes);

    return {
      success: true,
      inverseMutation: {
        type: 'ADD_PANEL',
        payload: { panel: panelKind },
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
 * Update an existing panel.
 *
 * Captures the panel's current schema state before applying updates,
 * and uses createPanelDataProvider for query/transformation updates.
 */
export const handleUpdatePanel = createHandler<UpdatePanelPayload>(async (payload, context) => {
  const { scene, transaction } = context;
  const { elementName, panelId, updates } = payload;

  try {
    const body = scene.state.body;
    if (!body) {
      throw new Error('Dashboard has no body');
    }

    const panels = body.getVizPanels();
    const panelToUpdate = findPanel(panels, elementName, panelId);

    if (!panelToUpdate) {
      throw new Error(`Panel not found: ${elementName ?? `panelId=${panelId}`}`);
    }

    // Capture previous state as schema-compatible PanelKind for inverse mutation
    const previousPanelKind = vizPanelToSchemaV2(panelToUpdate);

    // Build batched state updates
    const stateUpdate: Partial<Record<string, unknown>> = {};

    if (updates.title !== undefined) {
      stateUpdate.title = updates.title;
    }
    if (updates.description !== undefined) {
      stateUpdate.description = updates.description;
    }
    if (updates.transparent !== undefined) {
      stateUpdate.displayMode = updates.transparent ? 'transparent' : 'default';
    }

    if (updates.vizConfig !== undefined) {
      const vizConfig = updates.vizConfig;
      if (vizConfig.group !== undefined) {
        stateUpdate.pluginId = vizConfig.group;
      }
      if (vizConfig.version !== undefined) {
        stateUpdate.pluginVersion = vizConfig.version;
      }
      if (vizConfig.spec?.options !== undefined) {
        stateUpdate.options = {
          ...panelToUpdate.state.options,
          ...vizConfig.spec.options,
        };
      }
      if (vizConfig.spec?.fieldConfig !== undefined) {
        stateUpdate.fieldConfig = transformMappingsToV1(vizConfig.spec.fieldConfig);
      }
    }

    if (Object.keys(stateUpdate).length > 0) {
      panelToUpdate.setState(stateUpdate);
    }

    // Handle data updates using serialization utils
    if (updates.data !== undefined) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const currentPanelKind = vizPanelToSchemaV2(panelToUpdate) as PanelKind;
      const updatedPanelKind: PanelKind = {
        ...currentPanelKind,
        spec: { ...currentPanelKind.spec, data: updates.data },
      };
      const dataProvider = createPanelDataProvider(updatedPanelKind);
      panelToUpdate.setState({ $data: dataProvider });
    }

    const changes: MutationChange[] = [
      { path: `/elements/${elementName || panelId}`, previousValue: previousPanelKind, newValue: updates },
    ];
    transaction.changes.push(...changes);

    return {
      success: true,
      inverseMutation: {
        type: 'UPDATE_PANEL',
        payload: {
          elementName,
          panelId,
          updates: {
            title: previousPanelKind.kind === 'Panel' ? previousPanelKind.spec.title : undefined,
            description: previousPanelKind.kind === 'Panel' ? previousPanelKind.spec.description : undefined,
            transparent: previousPanelKind.kind === 'Panel' ? previousPanelKind.spec.transparent : undefined,
            vizConfig: previousPanelKind.kind === 'Panel' ? previousPanelKind.spec.vizConfig : undefined,
            data: previousPanelKind.kind === 'Panel' ? previousPanelKind.spec.data : undefined,
          },
        },
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
