/**
 * Panel mutation handlers
 */

import type { MutationResult, MutationChange, AddPanelPayload, RemovePanelPayload, UpdatePanelPayload } from '../types';

import type { MutationContext } from './types';

/**
 * Add a new panel to the dashboard
 */
export async function handleAddPanel(payload: AddPanelPayload, context: MutationContext): Promise<MutationResult> {
  const { scene, transaction } = context;

  try {
    // Extract values with defaults
    // Top-level fields take precedence, then spec fields, then defaults
    const title = payload.title ?? payload.spec?.title ?? 'New Panel';
    // VizConfigKind.group contains the plugin ID
    const vizType = payload.vizType ?? payload.spec?.vizConfig?.group ?? 'timeseries';
    const description = payload.description ?? payload.spec?.description ?? '';

    // Position is for future layout placement (not yet implemented)
    const _position = payload.position;
    void _position; // Suppress unused variable warning until layout positioning is implemented

    // Generate unique element name
    const elementName = `panel-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;

    // Use scene's addPanel method (simplified for POC)
    const body = scene.state.body;
    if (!body) {
      throw new Error('Dashboard has no body');
    }

    // For POC: Create a basic panel using VizPanel directly
    // Real implementation would use proper panel building utilities
    const { VizPanel } = await import('@grafana/scenes');

    const vizPanel = new VizPanel({
      title,
      pluginId: vizType,
      description,
      options: {},
      fieldConfig: { defaults: {}, overrides: [] },
      key: elementName,
    });

    // Add panel to scene
    scene.addPanel(vizPanel);

    const changes: MutationChange[] = [
      { path: `/elements/${elementName}`, previousValue: undefined, newValue: { title, vizType } },
    ];
    transaction.changes.push(...changes);

    return {
      success: true,
      inverseMutation: {
        type: 'REMOVE_PANEL',
        payload: { elementName },
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
 * Remove a panel from the dashboard
 */
export async function handleRemovePanel(
  payload: RemovePanelPayload,
  context: MutationContext
): Promise<MutationResult> {
  const { scene, transaction } = context;
  const { elementName, panelId } = payload;

  try {
    // Find the panel
    const body = scene.state.body;
    if (!body) {
      throw new Error('Dashboard has no body');
    }

    // Find panel by element name or ID
    const { VizPanel } = await import('@grafana/scenes');
    let panelToRemove: InstanceType<typeof VizPanel> | null = null;
    let panelState: Record<string, unknown> = {};

    // Search through the scene's panels
    const panels = body.getVizPanels?.() || [];
    for (const panel of panels) {
      const state = panel.state;
      if (elementName && state.key === elementName) {
        panelToRemove = panel;
        panelState = { ...state };
        break;
      }
      // panelId is stored internally, use key for matching
      if (panelId !== undefined && state.key && String(state.key).includes(String(panelId))) {
        panelToRemove = panel;
        panelState = { ...state };
        break;
      }
    }

    if (!panelToRemove) {
      throw new Error(`Panel not found: ${elementName || panelId}`);
    }

    // Remove the panel
    scene.removePanel(panelToRemove);

    const changes: MutationChange[] = [
      { path: `/elements/${elementName || panelId}`, previousValue: panelState, newValue: undefined },
    ];
    transaction.changes.push(...changes);

    return {
      success: true,
      inverseMutation: {
        type: 'REMOVE_PANEL',
        payload: { elementName: String(panelState.key) },
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
 * Update an existing panel
 */
export async function handleUpdatePanel(
  payload: UpdatePanelPayload,
  context: MutationContext
): Promise<MutationResult> {
  const { scene, transaction } = context;
  const { elementName, panelId, updates } = payload;

  try {
    // Find the panel
    const body = scene.state.body;
    if (!body) {
      throw new Error('Dashboard has no body');
    }

    const { VizPanel } = await import('@grafana/scenes');
    const panels = body.getVizPanels?.() || [];
    let panelToUpdate: InstanceType<typeof VizPanel> | null = null;

    for (const panel of panels) {
      const state = panel.state;
      if (elementName && state.key === elementName) {
        panelToUpdate = panel;
        break;
      }
      // panelId is stored internally, use key for matching
      if (panelId !== undefined && state.key && String(state.key).includes(String(panelId))) {
        panelToUpdate = panel;
        break;
      }
    }

    if (!panelToUpdate) {
      throw new Error(`Panel not found: ${elementName || panelId}`);
    }

    // Store previous state for rollback
    const previousState = { ...panelToUpdate.state };

    // Apply updates from PanelSpec
    if (updates.title !== undefined) {
      panelToUpdate.setState({ title: updates.title });
    }
    if (updates.description !== undefined) {
      panelToUpdate.setState({ description: updates.description });
    }
    // More updates would be handled here based on PanelSpec fields

    const changes: MutationChange[] = [
      { path: `/elements/${elementName || panelId}`, previousValue: previousState, newValue: updates },
    ];
    transaction.changes.push(...changes);

    return {
      success: true,
      inverseMutation: {
        type: 'UPDATE_PANEL',
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        payload: { elementName, panelId, updates: previousState as UpdatePanelPayload['updates'] },
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
 * Move a panel (stub - not fully implemented)
 */
export async function handleMovePanel(): Promise<MutationResult> {
  return {
    success: true,
    changes: [],
    warnings: ['Move panel is not fully implemented in POC'],
  };
}
