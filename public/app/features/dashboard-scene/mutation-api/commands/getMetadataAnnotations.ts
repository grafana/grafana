/**
 * GET_METADATA_ANNOTATIONS command
 *
 * Reads allowlisted keys on `metadata.annotations`. This is not the dashboard
 * spec and is not a query annotation layer (LIST_ANNOTATIONS).
 *
 * Today the only readable key is `grafana.app/useCrossDashboardVariables`.
 * Add further keys here (schema + read) rather than a new command per annotation.
 */

import type * as z from 'zod';

import { AnnoKeyUseCrossDashboardVariables } from 'app/features/apiserver/types';

import { parseUseCrossDashboardVariablesFromHost } from '../../utils/persistUseCrossDashboardVariables';

import { payloads } from './schemas';
import { requiresGlobalDashboardVariablesReadOnly, type MutationCommand } from './types';

const getMetadataAnnotationsPayloadSchema = payloads.getMetadataAnnotations;

export type GetMetadataAnnotationsPayload = z.infer<typeof getMetadataAnnotationsPayloadSchema>;

export const getMetadataAnnotationsCommand: MutationCommand<GetMetadataAnnotationsPayload> = {
  name: 'GET_METADATA_ANNOTATIONS',
  description: payloads.getMetadataAnnotations.description ?? '',

  payloadSchema: getMetadataAnnotationsPayloadSchema,
  // Permission stays tied to the only allowlisted key. Split per-key when more are added.
  permission: requiresGlobalDashboardVariablesReadOnly,
  readOnly: true,

  handler: async (payload, context) => {
    const { scene } = context;

    try {
      const annotations: Record<string, unknown> = {};

      for (const key of payload.annotations) {
        if (key === AnnoKeyUseCrossDashboardVariables) {
          annotations[key] = parseUseCrossDashboardVariablesFromHost(scene) ?? null;
        }
      }

      return {
        success: true,
        data: { annotations },
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
