/**
 * CHANGE_PANEL_TITLE command
 *
 * Thin wrapper around the existing `editPanelTitleAction`, built with
 * `createActionCommand`: the schema maps 1-1 to the params, `map` resolves the
 * element name to the scene VizPanel, and the action does the undoable change.
 */

import { z } from 'zod';

import { editPanelTitleAction } from '../../panel-edit/getPanelFrameOptions';

import { createActionCommand } from './createActionCommand';
import { resolvePanelByElementName } from './resolvePanel';
import { elementReferenceSchema } from './schemas';

export const changePanelTitleCommand = createActionCommand({
  name: 'CHANGE_PANEL_TITLE',
  description: 'Change the title of an existing panel',
  schema: z.object({
    panel: elementReferenceSchema.describe('Panel to update, identified by element name'),
    title: z.string().describe('New panel title'),
  }),
  map: (payload, { scene }) => ({
    panel: resolvePanelByElementName(scene, payload.panel.name),
    title: payload.title,
  }),
  // Call lazily (not as a bare reference at module load) to avoid an init cycle.
  action: ({ panel, title }) => editPanelTitleAction(panel, title),
});
