/**
 * TEMPORARY: Scene event → MutationRequest extractor.
 *
 * Post-POC, UI edits will route through DashboardMutationClient.execute() directly,
 * eliminating the need for scene event parsing entirely. See design doc
 * "Unify Mutation Paths" section.
 */
import {
  SceneObjectStateChangedEvent,
  VizPanel,
  SceneVariableSet,
} from '@grafana/scenes';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DashboardGridItem } from 'app/features/dashboard-scene/scene/layout-default/DashboardGridItem';
import { isSceneVariableInstance } from 'app/features/dashboard-scene/settings/variables/utils';

import { countPanels, LARGE_DASHBOARD_PANEL_THRESHOLD, LARGE_DASHBOARD_THROTTLE_MS } from './collabEdgeCases';
import { debugLog } from './debugLog';
import { getLockTarget } from './lockTargetMapping';
import { CollabOperation, MutationRequest } from './protocol/messages';

/** Ref-counted suppression depth — safe under concurrent async ops.
 *  Each suppressExtraction() increments, each unsuppressExtraction() decrements.
 *  Extraction is suppressed whenever depth > 0. Math.max guards against mismatched calls. */
let suppressionDepth = 0;

/** Suppress extraction (call before applying remote ops locally). */
export function suppressExtraction(): void {
  suppressionDepth++;
}

/** Unsuppress extraction (call after applying remote ops locally). */
export function unsuppressExtraction(): void {
  suppressionDepth = Math.max(0, suppressionDepth - 1);
}

/** Returns true if extraction is currently suppressed. */
export function isExtractionSuppressed(): boolean {
  return suppressionDepth > 0;
}

/** Throttle state for large dashboards (edge case #5). */
let lastExtractionTime = 0;
let largeDashboardMode = false;

/**
 * Enable or disable large-dashboard throttle mode.
 * When enabled, extractMutationRequest drops events that arrive
 * faster than LARGE_DASHBOARD_THROTTLE_MS apart.
 */
export function setLargeDashboardMode(scene: { state: { body?: { state?: { children?: unknown[] } } } }): void {
  const panelCount = countPanels(scene);
  largeDashboardMode = panelCount > LARGE_DASHBOARD_PANEL_THRESHOLD;
  if (largeDashboardMode) {
    debugLog('Large dashboard throttle activated', { panelCount, threshold: LARGE_DASHBOARD_PANEL_THRESHOLD });
  }
}

/**
 * Extracts a CollabOperation from a SceneObjectStateChangedEvent.
 * Returns null if the event doesn't map to a supported mutation or extraction is suppressed.
 */
export function extractMutationRequest(event: SceneObjectStateChangedEvent): CollabOperation | null {
  if (isExtractionSuppressed()) {
    debugLog('Extraction skipped — suppression flag is set');
    return null;
  }

  // Edge case #5: throttle extraction for large dashboards
  if (largeDashboardMode) {
    const now = Date.now();
    if (now - lastExtractionTime < LARGE_DASHBOARD_THROTTLE_MS) {
      debugLog('Extraction skipped — large dashboard throttle');
      return null;
    }
    lastExtractionTime = now;
  }

  const { changedObject, partialUpdate } = event.payload;

  let result: CollabOperation | null = null;

  // VizPanel changes → UPDATE_PANEL
  if (changedObject instanceof VizPanel) {
    result = extractPanelChange(changedObject, partialUpdate);
  }

  // DashboardGridItem position/size → MOVE_PANEL
  else if (changedObject instanceof DashboardGridItem) {
    result = extractGridItemChange(changedObject, partialUpdate);
  }

  // DashboardScene persisted props → UPDATE_DASHBOARD_INFO
  else if (changedObject instanceof DashboardScene) {
    result = extractDashboardChange(partialUpdate);
  }

  // SceneVariableSet changes → UPDATE_VARIABLE
  else if (changedObject instanceof SceneVariableSet) {
    result = extractVariableSetChange(partialUpdate);
  }

  // Individual variable instance changes → UPDATE_VARIABLE
  else if (isSceneVariableInstance(changedObject)) {
    result = extractVariableChange(changedObject);
  }

  if (result) {
    debugLog('MutationRequest produced', { type: result.mutation.type, lockTarget: result.lockTarget });
  } else {
    const objectType = changedObject?.constructor?.name ?? 'unknown';
    debugLog('Scene change detected but no mutation produced', { objectType, changedKeys: Object.keys(partialUpdate) });
  }

  return result;
}

function extractPanelChange(
  panel: VizPanel,
  partialUpdate: Partial<Record<string, unknown>>
): CollabOperation | null {
  const elementName = panel.state.key;
  if (!elementName) {
    return null;
  }

  // Skip _renderCounter changes — not persisted
  const keys = Object.keys(partialUpdate);
  if (keys.length === 1 && keys[0] === '_renderCounter') {
    return null;
  }

  // Build the partial panel spec from the scene state changes.
  // The UPDATE_PANEL Zod schema expects:
  //   { element: { name }, panel: { kind: 'Panel', spec: { title?, description?, ... } } }
  const spec: Record<string, unknown> = {};

  if ('title' in partialUpdate) {
    spec.title = partialUpdate.title;
  }
  if ('description' in partialUpdate) {
    spec.description = partialUpdate.description;
  }
  if ('displayMode' in partialUpdate) {
    spec.transparent = partialUpdate.displayMode === 'transparent';
  }
  if ('options' in partialUpdate) {
    spec.vizConfig = {
      spec: { options: partialUpdate.options },
    };
  }
  if ('fieldConfig' in partialUpdate) {
    /* eslint-disable @typescript-eslint/consistent-type-assertions -- building nested spec object from loosely-typed partialUpdate */
    const existingVizConfig = spec.vizConfig as Record<string, unknown> | undefined;
    const existingSpec = existingVizConfig?.spec as Record<string, unknown> | undefined;
    /* eslint-enable @typescript-eslint/consistent-type-assertions */
    spec.vizConfig = {
      ...existingVizConfig,
      spec: {
        ...existingSpec,
        fieldConfig: partialUpdate.fieldConfig,
      },
    };
  }
  if ('pluginId' in partialUpdate) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- building nested spec object from loosely-typed partialUpdate
    const existingVizConfig = spec.vizConfig as Record<string, unknown> | undefined;
    spec.vizConfig = {
      ...existingVizConfig,
      group: partialUpdate.pluginId,
    };
  }

  // If no recognized spec fields were extracted, skip
  if (Object.keys(spec).length === 0) {
    debugLog('VizPanel change has no mappable spec fields', { elementName, changedKeys: keys });
    return null;
  }

  const mutation: MutationRequest = {
    type: 'UPDATE_PANEL',
    payload: {
      element: { kind: 'ElementReference', name: elementName },
      panel: { kind: 'Panel', spec },
    },
  };

  return {
    mutation,
    lockTarget: getLockTarget(mutation),
  };
}

function extractGridItemChange(
  gridItem: DashboardGridItem,
  partialUpdate: Partial<Record<string, unknown>>
): CollabOperation | null {
  // DashboardGridItem has position/size properties
  const hasPositionChange =
    'x' in partialUpdate || 'y' in partialUpdate || 'width' in partialUpdate || 'height' in partialUpdate;

  if (!hasPositionChange) {
    return null;
  }

  // Find the panel element name from the grid item's body
  const body = gridItem.state.body;
  const elementName = body instanceof VizPanel ? body.state.key : gridItem.state.key;

  if (!elementName) {
    return null;
  }

  // Build the MOVE_PANEL payload matching the Zod schema:
  //   { element: { name }, layoutItem?: { spec: { x?, y?, width?, height? } } }
  const positionSpec: Record<string, unknown> = {};
  if ('x' in partialUpdate) {
    positionSpec.x = partialUpdate.x;
  }
  if ('y' in partialUpdate) {
    positionSpec.y = partialUpdate.y;
  }
  if ('width' in partialUpdate) {
    positionSpec.width = partialUpdate.width;
  }
  if ('height' in partialUpdate) {
    positionSpec.height = partialUpdate.height;
  }

  const mutation: MutationRequest = {
    type: 'MOVE_PANEL',
    payload: {
      element: { kind: 'ElementReference', name: elementName },
      layoutItem: { spec: positionSpec },
    },
  };

  return {
    mutation,
    lockTarget: getLockTarget(mutation),
  };
}

function extractDashboardChange(partialUpdate: Partial<Record<string, unknown>>): CollabOperation | null {
  const dashboardProps = ['title', 'description', 'tags'];
  const relevantChanges: Record<string, unknown> = {};

  for (const prop of dashboardProps) {
    if (prop in partialUpdate) {
      relevantChanges[prop] = partialUpdate[prop];
    }
  }

  if (Object.keys(relevantChanges).length === 0) {
    return null;
  }

  const mutation: MutationRequest = {
    type: 'UPDATE_DASHBOARD_INFO',
    payload: relevantChanges,
  };

  return {
    mutation,
    lockTarget: getLockTarget(mutation),
  };
}

function extractVariableSetChange(partialUpdate: Partial<Record<string, unknown>>): CollabOperation | null {
  // SceneVariableSet changes indicate variable list modifications (add/remove)
  if (!('variables' in partialUpdate)) {
    return null;
  }

  const mutation: MutationRequest = {
    type: 'UPDATE_VARIABLE',
    payload: {
      variables: partialUpdate.variables,
    },
  };

  return {
    mutation,
    lockTarget: getLockTarget(mutation),
  };
}

function extractVariableChange(changedObject: { state: { key?: string; name?: string } }): CollabOperation | null {
  const variableId = changedObject.state.key || changedObject.state.name;
  if (!variableId) {
    return null;
  }

  const mutation: MutationRequest = {
    type: 'UPDATE_VARIABLE',
    payload: {
      variableId,
    },
  };

  return {
    mutation,
    lockTarget: getLockTarget(mutation),
  };
}
