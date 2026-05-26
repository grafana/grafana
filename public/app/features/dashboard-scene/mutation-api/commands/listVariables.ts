/**
 * LIST_VARIABLES -- canonical ReadClientCommand example.
 *
 * Read commands return data without mutating state and do not enter the
 * undo/redo stack. The UI does not consume them (Scenes subscriptions are
 * the UI's read channel); the agent does, via MutationApiClient.execute().
 */

import { type z } from 'zod';

import { SceneVariableSet } from '@grafana/scenes';
import type { VariableKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { sceneVariablesSetToSchemaV2Variables } from '../../serialization/sceneVariablesSetToVariables';
import { type ReadClientCommand } from '../ClientCommand';

import { payloads } from './schemas';

type ListVariablesPayload = z.infer<typeof payloads.listVariables>;

export const listVariablesClientCommand: ReadClientCommand<ListVariablesPayload, { variables: VariableKind[] }> = {
  type: 'LIST_VARIABLES',
  description: payloads.listVariables.description ?? '',
  schema: payloads.listVariables,
  kind: 'read',
  read(_payload, ctx) {
    const varSet = ctx.scene.state.$variables;
    if (!varSet || !(varSet instanceof SceneVariableSet)) {
      return { variables: [] };
    }
    return { variables: sceneVariablesSetToSchemaV2Variables(varSet, true) };
  },
};
