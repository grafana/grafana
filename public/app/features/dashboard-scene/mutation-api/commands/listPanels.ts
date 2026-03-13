/**
 * LIST_PANELS command
 *
 * Returns all elements on the dashboard (panels, library panels, etc.)
 * as an array of { element, layoutItem } entries. The element name is
 * embedded in layoutItem.spec.element.name (v2beta1 ElementReference).
 *
 * When evaluateVariables is true, an evaluatedQueries array is included
 * with template variables resolved to their current values.
 */

import { z } from 'zod';

import { sceneGraph, type SceneObject } from '@grafana/scenes';

import { getElements } from '../../serialization/layoutSerializers/utils';
import { getVizPanelKeyForPanelId } from '../../utils/utils';

import { serializeResultLayoutItem } from './panelSerialization';
import { payloads } from './schemas';
import { readOnly, type MutationCommand } from './types';

export const listPanelsPayloadSchema = payloads.listPanels;

export type ListPanelsPayload = z.infer<typeof listPanelsPayloadSchema>;

function deepInterpolate(sceneObj: SceneObject, value: unknown): unknown {
  if (typeof value === 'string') {
    return sceneGraph.interpolate(sceneObj, value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepInterpolate(sceneObj, item));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = deepInterpolate(sceneObj, v);
    }
    return result;
  }
  return value;
}

export const listPanelsCommand: MutationCommand<ListPanelsPayload> = {
  name: 'LIST_PANELS',
  description: payloads.listPanels.description ?? '',

  payloadSchema: payloads.listPanels,
  permission: readOnly,
  readOnly: true,

  handler: async (payload, context) => {
    const { scene } = context;

    try {
      const body = scene.state.body;
      const fullElements = getElements(body, scene);
      const allPanels = body.getVizPanels();

      const elements: Array<{ element: unknown; layoutItem: unknown }> = [];

      for (const [elementName, element] of Object.entries(fullElements)) {
        const panelId = scene.serializer.getPanelIdForElement(elementName);
        const expectedKey = panelId !== undefined ? getVizPanelKeyForPanelId(panelId) : undefined;
        const vizPanel = expectedKey ? allPanels.find((p) => p.state.key === expectedKey) : undefined;

        const layoutItem = vizPanel
          ? serializeResultLayoutItem(vizPanel)
          : {
              kind: 'AutoGridLayoutItem' as const,
              spec: { element: { kind: 'ElementReference' as const, name: elementName } },
            };

        elements.push({ element, layoutItem });
      }

      const data: Record<string, unknown> = { elements };

      if (payload.evaluateVariables) {
        const evaluated: unknown[] = [];
        for (const [elementName, element] of Object.entries(fullElements)) {
          const plain = JSON.parse(JSON.stringify(element));
          const queries = plain?.spec?.data?.spec?.queries;
          if (!Array.isArray(queries) || queries.length === 0) {
            continue;
          }
          for (const query of queries) {
            const resolved = deepInterpolate(scene, query);
            if (JSON.stringify(resolved) !== JSON.stringify(query)) {
              evaluated.push({ element: elementName, original: query, evaluated: resolved });
            }
          }
        }
        if (evaluated.length > 0) {
          data.evaluatedQueries = evaluated;
        }
      }

      return {
        success: true,
        data,
        changes: [],
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
