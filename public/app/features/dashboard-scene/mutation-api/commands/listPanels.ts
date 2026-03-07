/**
 * LIST_PANELS command
 *
 * Returns all elements on the dashboard (panels, library panels, etc.)
 * as an array of { element, layoutItem } entries. The element name is
 * embedded in layoutItem.spec.element.name (v2beta1 ElementReference).
 */

import { z } from 'zod';

import { getElements } from '../../serialization/layoutSerializers/utils';
import { getVizPanelKeyForPanelId } from '../../utils/utils';

import { serializeResultLayoutItem } from './movePanel';
import { payloads } from './schemas';
import { readOnly, type MutationCommand } from './types';

export const listPanelsPayloadSchema = payloads.listPanels;

export type ListPanelsPayload = z.infer<typeof listPanelsPayloadSchema>;

export const listPanelsCommand: MutationCommand<ListPanelsPayload> = {
  name: 'LIST_PANELS',
  description: payloads.listPanels.description ?? '',

  payloadSchema: payloads.listPanels,
  permission: readOnly,
  readOnly: true,

  handler: async (_payload, context) => {
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
          ? serializeResultLayoutItem(vizPanel, elementName)
          : { kind: 'AutoGridLayoutItem' as const, spec: { element: { kind: 'ElementReference' as const, name: elementName } } };

        elements.push({ element, layoutItem });
      }

      return {
        success: true,
        data: { elements },
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
