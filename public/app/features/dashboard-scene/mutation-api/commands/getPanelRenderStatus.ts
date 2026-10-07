/**
 * GET_PANEL_RENDER_STATUS command
 *
 * Returns the last draw result of the dashboard's panels that report one (see
 * app/features/panel/panelRenderStatus). Today that is the Custom panel, whose drawing runs in a
 * sandboxed frame that neither the DOM nor a browser-side screenshot can see into. With
 * includeImage, each reporting panel that can capture itself also returns a PNG data URL of its
 * drawing; with includeData, the shape of the data the drawing received; with includeLayout, a
 * report of content that spills out, is cut or is drawn over other text. reveal brings one panel
 * into view first (switching tabs, expanding rows, scrolling), which changes the view but not the
 * dashboard, and waitMs waits for its drawing to settle. No permissions required.
 */

import type * as z from 'zod';

import { SceneGridRow, type VizPanel } from '@grafana/scenes';
import {
  capturePanelRender,
  getPanelRenderData,
  getPanelRenderStatuses,
  measurePanelLayout,
  type PanelRenderDataSummary,
  type PanelRenderLayout,
  type PanelRenderStatus,
} from 'app/features/panel/panelRenderStatus';

import { RowItem } from '../../scene/layout-rows/RowItem';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { focusVizPanel } from '../../utils/focusPanel';
import { getPanelIdForVizPanel } from '../../utils/utils-panels';

import { MAX_RENDER_STATUS_IMAGE_CHARS, MAX_RENDER_STATUS_IMAGES, payloads } from './schemas';
import { readOnly, type MutationCommand } from './types';

export type GetPanelRenderStatusPayload = z.infer<typeof payloads.getPanelRenderStatus>;

const CUSTOM_PANEL_PLUGIN_ID = 'custom-panel';
const WAIT_POLL_MS = 100;

/** Why a Custom panel has no draw status: it is not rendered right now. */
export type NotMountedReason = 'inactive-tab' | 'collapsed-row' | 'no-code' | 'not-rendered';

export interface PanelRenderStatusEntry extends Omit<PanelRenderStatus, 'updatedAt' | 'state'> {
  element: string;
  /** not-mounted: a Custom panel that is not rendered right now, so it cannot draw; see reason. */
  state: PanelRenderStatus['state'] | 'not-mounted';
  reason?: NotMountedReason;
  /** Milliseconds since the status last changed. */
  ageMs: number;
  data?: PanelRenderDataSummary;
  layout?: PanelRenderLayout;
  layoutError?: string;
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
      if (payload.reveal && requested?.size !== 1) {
        return {
          success: false,
          error: 'reveal brings one panel into view: pass exactly one element.',
          changes: [],
        };
      }

      const targets: Array<{ element: string; panelId: number; vizPanel: VizPanel }> = [];
      for (const vizPanel of scene.state.body.getVizPanels()) {
        const panelId = getPanelIdForVizPanel(vizPanel);
        const element = scene.serializer.getElementIdForPanel(panelId) ?? `panel-${panelId}`;
        if (!requested || requested.has(element)) {
          targets.push({ element, panelId, vizPanel });
        }
      }

      if (payload.reveal && targets[0]) {
        focusVizPanel(targets[0].vizPanel);
      }
      if (payload.waitMs > 0) {
        const drawing = targets.filter(({ vizPanel }) => isCustomPanel(vizPanel) && hasCode(vizPanel));
        await waitUntilSettled(
          drawing.map((target) => target.panelId),
          payload.waitMs,
          payload.reveal === true
        );
      }

      const now = Date.now();
      const panels: PanelRenderStatusEntry[] = [];
      const silent: string[] = [];
      for (const { element, panelId, vizPanel } of targets) {
        const statuses = getPanelRenderStatuses(panelId);
        if (statuses.length === 0) {
          if (isCustomPanel(vizPanel)) {
            panels.push({
              element,
              panelId,
              pluginId: CUSTOM_PANEL_PLUGIN_ID,
              state: 'not-mounted',
              reason: notMountedReason(vizPanel),
              final: false,
              ageMs: 0,
            });
          } else {
            silent.push(element);
          }
          continue;
        }
        for (const { updatedAt, ...rest } of statuses) {
          const entry: PanelRenderStatusEntry = { element, ...rest, ageMs: Math.max(0, now - updatedAt) };
          if (payload.includeData) {
            const data = getPanelRenderData(panelId, rest.instanceKey);
            if (data) {
              entry.data = data;
            }
          }
          panels.push(entry);
        }
      }

      if (payload.includeLayout) {
        await addLayouts(panels);
      }
      if (payload.includeImage) {
        await addImages(panels);
      }

      const warnings: string[] = [];
      const found = new Set(targets.map((target) => target.element));
      const missing = requested ? [...requested].filter((name) => !found.has(name)) : [];
      if (missing.length > 0) {
        warnings.push(`Not on this dashboard: ${missing.join(', ')}.`);
      }
      if (requested && silent.length > 0) {
        warnings.push(`These panels do not report a draw status (only Custom panels do): ${silent.join(', ')}.`);
      }
      const notMounted = panels.filter((entry) => entry.state === 'not-mounted').map((entry) => entry.element);
      if (notMounted.length > 0) {
        warnings.push(
          `These Custom panels are not rendered right now, so they have not drawn: ${notMounted.join(', ')}. ` +
            'Pass reveal with one of them to bring it into view.'
        );
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

async function addLayouts(panels: PanelRenderStatusEntry[]): Promise<void> {
  await Promise.all(
    panels.map(async (entry) => {
      if (entry.state === 'not-mounted') {
        return;
      }
      const measure = measurePanelLayout(entry.panelId, entry.instanceKey);
      if (!measure) {
        entry.layoutError = 'This panel cannot measure its layout.';
        return;
      }
      try {
        entry.layout = await measure;
      } catch (error) {
        entry.layoutError = error instanceof Error ? error.message : String(error);
      }
    })
  );
}

/** Captures one at a time, so the response and the memory it takes stay under a total budget. */
async function addImages(panels: PanelRenderStatusEntry[]): Promise<void> {
  let total = 0;
  let count = 0;
  for (const entry of panels) {
    if (entry.state === 'not-mounted') {
      continue;
    }
    if (count >= MAX_RENDER_STATUS_IMAGES || total >= MAX_RENDER_STATUS_IMAGE_CHARS) {
      entry.imageError = 'Left out: the response already holds as many images as it can. Ask for fewer elements.';
      continue;
    }
    const capture = capturePanelRender(entry.panelId, entry.instanceKey);
    if (!capture) {
      entry.imageError = 'This panel cannot capture its drawing.';
      continue;
    }
    try {
      const image = await capture;
      if (total + image.length > MAX_RENDER_STATUS_IMAGE_CHARS) {
        entry.imageError = 'Left out: the image would take the response over its size limit. Ask for fewer elements.';
        total = MAX_RENDER_STATUS_IMAGE_CHARS;
        continue;
      }
      entry.image = image;
      total += image.length;
      count++;
    } catch (error) {
      entry.imageError = error instanceof Error ? error.message : String(error);
    }
  }
}

/** A status that will not change without new input: an error, or a draw of final data. */
function isSettled(status: PanelRenderStatus): boolean {
  return status.state === 'error' || (status.state === 'drawn' && status.final);
}

/**
 * Waits until every panel among panelIds has settled, or the time is up. A panel that does not
 * report yet (still mounting after a reveal) counts as unsettled until it does. A panel out of view
 * does not draw, so it counts as settled, unless it was just revealed and is coming into view.
 */
async function waitUntilSettled(panelIds: number[], waitMs: number, revealed: boolean): Promise<void> {
  const deadline = Date.now() + waitMs;
  const settled = () =>
    panelIds.every((panelId) => {
      const statuses = getPanelRenderStatuses(panelId);
      return (
        statuses.length > 0 && statuses.every((status) => isSettled(status) || (!revealed && status.paused === true))
      );
    });
  while (!settled() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, WAIT_POLL_MS));
  }
}

function notMountedReason(vizPanel: VizPanel): NotMountedReason {
  for (let parent = vizPanel.parent; parent; parent = parent.parent) {
    if (parent instanceof TabItem && !parent.isCurrentTab()) {
      return 'inactive-tab';
    }
    if (
      (parent instanceof RowItem && parent.state.collapse) ||
      (parent instanceof SceneGridRow && parent.state.isCollapsed)
    ) {
      return 'collapsed-row';
    }
  }
  return hasCode(vizPanel) ? 'not-rendered' : 'no-code';
}

function isCustomPanel(vizPanel: VizPanel): boolean {
  return vizPanel.state.pluginId === CUSTOM_PANEL_PLUGIN_ID;
}

/** A Custom panel without code shows a hint instead of a drawing and never reports. */
function hasCode(vizPanel: VizPanel): boolean {
  const options: unknown = vizPanel.state.options;
  const code: unknown = options && typeof options === 'object' ? Reflect.get(options, 'code') : undefined;
  return typeof code === 'string' && code.trim() !== '';
}
