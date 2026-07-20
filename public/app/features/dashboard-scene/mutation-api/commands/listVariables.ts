/**
 * LIST_VARIABLES command
 *
 * List template variables for a scope (dashboard or row/tab section) in v2beta1 VariableKind format.
 */

import { type z } from 'zod';

import { SceneVariableSet } from '@grafana/scenes';

import { sceneVariablesSetToSchemaV2Variables } from '../../serialization/sceneVariablesSetToVariables';

import { payloads } from './schemas';
import { readOnly, type MutationCommand } from './types';
import { getEffectiveVariableParentPath, resolveVariableScope } from './variableScope';

const listVariablesPayloadSchema = payloads.listVariables;

type ListVariablesPayload = z.infer<typeof listVariablesPayloadSchema>;

export const listVariablesCommand: MutationCommand<ListVariablesPayload> = {
  name: 'LIST_VARIABLES',
  description: payloads.listVariables.description ?? '',

  payloadSchema: payloads.listVariables,
  permission: readOnly,
  readOnly: true,

  handler: async (payload, context) => {
    const { scene } = context;

    try {
      const effectiveParentPath = getEffectiveVariableParentPath(payload.parentPath);
      const { scopeOwner } = resolveVariableScope(scene, effectiveParentPath);

      const varSet = scopeOwner.state.$variables;
      if (!varSet || !(varSet instanceof SceneVariableSet)) {
        return {
          success: true,
          data: { variables: [], scopePath: effectiveParentPath },
          changes: [],
        };
      }

      const variables = sceneVariablesSetToSchemaV2Variables(varSet, true);

      return {
        success: true,
        data: { variables, scopePath: effectiveParentPath },
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
