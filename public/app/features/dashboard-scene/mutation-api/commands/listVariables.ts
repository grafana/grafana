/**
 * LIST_VARIABLES command
 *
 * List all template variables in the current dashboard in v2beta1 VariableKind format.
 */

import { SceneVariableSet } from '@grafana/scenes';

import { sceneVariablesSetToSchemaV2Variables } from '../../serialization/sceneVariablesSetToVariables';

import { payloads } from './schemas';
import { readOnly, type MutationCommand } from './types';

export const listVariablesCommand: MutationCommand<Record<string, never>> = {
  name: 'LIST_VARIABLES',
  description: payloads.listVariables.description ?? '',

  payloadSchema: payloads.listVariables,
  permission: readOnly,

  handler: async (_payload, context) => {
    const { scene } = context;

    try {
      const varSet = scene.state.$variables;
      if (!varSet || !(varSet instanceof SceneVariableSet)) {
        return {
          success: true,
          data: { variables: [] },
          changes: [],
        };
      }

      const variables = sceneVariablesSetToSchemaV2Variables(varSet, true);

      return {
        success: true,
        data: { variables },
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
