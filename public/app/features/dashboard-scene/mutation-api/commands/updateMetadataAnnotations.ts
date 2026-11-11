/**
 * UPDATE_METADATA_ANNOTATIONS command
 *
 * Writes allowlisted keys on `metadata.annotations`. This is not the dashboard
 * spec and is not a query annotation layer (ADD_ANNOTATION / UPDATE_ANNOTATION).
 *
 * Today the only writable key is `grafana.app/useCrossDashboardVariables`.
 * Add further keys here (schema + persist) rather than a new command per annotation.
 */

import type * as z from 'zod';

import { AnnoKeyUseCrossDashboardVariables } from 'app/features/apiserver/types';

import { serializeUseCrossDashboardVariables } from '../../utils/crossDashboardVariablesSelection';
import {
  parseUseCrossDashboardVariablesFromHost,
  persistUseCrossDashboardVariables,
} from '../../utils/persistUseCrossDashboardVariables';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresGlobalDashboardVariables, type MutationCommand } from './types';

const updateMetadataAnnotationsPayloadSchema = payloads.updateMetadataAnnotations;

export type UpdateMetadataAnnotationsPayload = z.infer<typeof updateMetadataAnnotationsPayloadSchema>;

const CHANGE_PATH = `/metadata/annotations/${AnnoKeyUseCrossDashboardVariables}`;

const CLEARED_SELECTION = { global: 'none' as const, folder: 'none' as const };

export const updateMetadataAnnotationsCommand: MutationCommand<UpdateMetadataAnnotationsPayload> = {
  name: 'UPDATE_METADATA_ANNOTATIONS',
  description: payloads.updateMetadataAnnotations.description ?? '',

  payloadSchema: updateMetadataAnnotationsPayloadSchema,
  // Permission stays tied to the only allowlisted key. Split per-key when more are added.
  permission: requiresGlobalDashboardVariables,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const previousSelection = parseUseCrossDashboardVariablesFromHost(scene);
      const previousValue = previousSelection ? serializeUseCrossDashboardVariables(previousSelection) : undefined;

      const nextSelection = payload.annotations[AnnoKeyUseCrossDashboardVariables] ?? CLEARED_SELECTION;
      await persistUseCrossDashboardVariables(scene, nextSelection);

      const newSelection = parseUseCrossDashboardVariablesFromHost(scene);
      const newValue = newSelection ? serializeUseCrossDashboardVariables(newSelection) : undefined;

      return {
        success: true,
        data: {
          annotations: {
            [AnnoKeyUseCrossDashboardVariables]: newSelection ?? null,
          },
        },
        changes: [{ path: CHANGE_PATH, previousValue: previousValue ?? null, newValue: newValue ?? null }],
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
