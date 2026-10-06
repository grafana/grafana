/**
 * GET_PANEL_RENDER_STATUS command
 *
 * Returns the last draw result of the dashboard's panels that report one (see
 * app/features/panel/panelRenderStatus). Today that is the Custom panel, whose drawing runs in a
 * sandboxed frame that neither the DOM nor a browser-side screenshot can see into. With
 * includeImage, each reporting panel that can capture itself also returns a PNG data URL of its
 * drawing. Read-only, no permissions required.
 */

import type * as z from 'zod';

import { capturePanelRender, getPanelRenderStatus, type PanelRenderStatus } from 'app/features/panel/panelRenderStatus';

import { getPanelIdForVizPanel } from '../../utils/utils-panels';

import { MAX_RENDER_STATUS_IMAGES, payloads } from './schemas';
import { readOnly, type MutationCommand } from './types';

export type GetPanelRenderStatusPayload = z.infer<typeof payloads.getPanelRenderStatus>;

export interface PanelRenderStatusEntry extends Omit<PanelRenderStatus, 'updatedAt'> {
  element: string;
  /** Milliseconds since the status last changed. */
  ageMs: number;
  image?: string;
  imageError?: string;
}

export const getPanelRenderStatusCommand: MutationCommand<GetPanelRenderStatusPayload> = {
  name: 'GET_PANEL_RENDER_STATUS',
  description: payloads.getPanelRenderStatus.description ?? '',

  payloadSchema: payloads.getPanelRenderStatus,
  permission: readOnly,
  readOnly: true,

  handler: async (payload, context) => {
    const { scene } = context;

    try {
      const requested = payload.elements ? new Set(payload.elements) : undefined;
      const found = new Set<string>();
      const panels: PanelRenderStatusEntry[] = [];
      const now = Date.now();

      for (const vizPanel of scene.state.body.getVizPanels()) {
        const panelId = getPanelIdForVizPanel(vizPanel);
        const element = scene.serializer.getElementIdForPanel(panelId) ?? `panel-${panelId}`;
        if (requested && !requested.has(element)) {
          continue;
        }
        found.add(element);
        const status = getPanelRenderStatus(panelId);
        if (!status) {
          continue;
        }
        const { updatedAt, ...rest } = status;
        panels.push({ element, ...rest, ageMs: Math.max(0, now - updatedAt) });
      }

      if (payload.includeImage) {
        await Promise.all(
          panels.slice(0, MAX_RENDER_STATUS_IMAGES).map(async (entry) => {
            const capture = capturePanelRender(entry.panelId);
            if (!capture) {
              entry.imageError = 'This panel cannot capture its drawing.';
              return;
            }
            try {
              entry.image = await capture;
            } catch (error) {
              entry.imageError = error instanceof Error ? error.message : String(error);
            }
          })
        );
      }

      const warnings: string[] = [];
      const missing = requested ? [...requested].filter((name) => !found.has(name)) : [];
      if (missing.length > 0) {
        warnings.push(`Not on this dashboard: ${missing.join(', ')}.`);
      }
      const silent = [...found].filter((name) => !panels.some((entry) => entry.element === name));
      if (requested && silent.length > 0) {
        warnings.push(`These panels do not report a draw status (only Custom panels do): ${silent.join(', ')}.`);
      }

      return {
        success: true,
        data: { panels },
        changes: [],
        ...(warnings.length > 0 && { warnings }),
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
