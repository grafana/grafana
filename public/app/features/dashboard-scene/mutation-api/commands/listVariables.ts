/**
 * LIST_VARIABLES -- canonical read command.
 *
 * Read commands return data without mutating state and do not enter the
 * undo/redo stack. The UI does not consume them (Scenes subscriptions are
 * the UI's read channel); the agent does, via MutationApiClient.execute().
 */

import { type z } from 'zod';

import { SceneVariableSet } from '@grafana/scenes';

import { sceneVariablesSetToSchemaV2Variables } from '../../serialization/sceneVariablesSetToVariables';
import { type ClientCommand } from '../ClientCommand';

import { payloads } from './schemas';

type ListVariablesPayload = z.infer<typeof payloads.listVariables>;

export const listVariablesClientCommand: ClientCommand<ListVariablesPayload> = {
  type: 'LIST_VARIABLES',
  description: payloads.listVariables.description ?? '',
  kind: 'read',
  schema: payloads.listVariables,
  read(_payload, ctx) {
    const varSet = ctx.scene.state.$variables;
    if (!varSet || !(varSet instanceof SceneVariableSet)) {
      return { variables: [] };
    }
    return { variables: sceneVariablesSetToSchemaV2Variables(varSet, true) };
  },
};
