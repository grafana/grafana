/**
 * UPDATE_VARIABLE command
 *
 * Replace an existing template variable with a new definition, preserving its position.
 */

import { type z } from 'zod';

import type { VariableKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { createSceneVariableFromVariableModel } from '../../serialization/transformSaveModelSchemaV2ToScene';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';
import {
  buildVariableChangePath,
  findSectionPathsContainingVariable,
  getEffectiveVariableParentPath,
  isSectionVariablesFeatureEnabled,
  resolveVariableScope,
} from './variableScope';
import { dashboardHasVariableNamed, getScopeVariableArray, replaceScopeVariableSet } from './variableUtils';

const updateVariablePayloadSchema = payloads.updateVariable;

export type UpdateVariablePayload = z.infer<typeof updateVariablePayloadSchema>;

export const updateVariableCommand: MutationCommand<UpdateVariablePayload> = {
  name: 'UPDATE_VARIABLE',
  description: payloads.updateVariable.description ?? '',

  payloadSchema: payloads.updateVariable,
  permission: requiresEdit,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { name, variable: variableKind, parentPath } = payload;
      const effectiveParentPath = getEffectiveVariableParentPath(parentPath);
      const sectionVariablesEnabled = isSectionVariablesFeatureEnabled();

      let scope;
      if (effectiveParentPath === '/') {
        if (!dashboardHasVariableNamed(scene, name)) {
          const sectionPaths = sectionVariablesEnabled ? findSectionPathsContainingVariable(scene, name) : [];
          if (sectionPaths.length === 0) {
            throw new Error(`Variable '${name}' not found`);
          }
          throw new Error(
            `Variable '${name}' is not on the dashboard. Pass parentPath to update a section variable (e.g. "${sectionPaths[0]}").`
          );
        }
        scope = resolveVariableScope(scene, '/');
      } else {
        scope = resolveVariableScope(scene, effectiveParentPath);
      }

      const { scopeOwner, layoutPathPrefix } = scope;

      const currentVariables = [...getScopeVariableArray(scopeOwner)];

      const existingIndex = currentVariables.findIndex((v) => v.state.name === name);
      if (existingIndex === -1) {
        throw new Error(`Variable '${name}' not found`);
      }

      const previousState = currentVariables[existingIndex].state;

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod output is structurally compatible with VariableKind
      const newSceneVariable = createSceneVariableFromVariableModel(variableKind as VariableKind);
      // Preserve scene identity across the replacement - element pickers, highlight
      // overlays, and attached assistant context address the variable by scene key.
      newSceneVariable.setState({ key: previousState.key });
      currentVariables[existingIndex] = newSceneVariable;

      replaceScopeVariableSet(scopeOwner, currentVariables);

      const changePath = buildVariableChangePath(layoutPathPrefix, name);

      return {
        success: true,
        data: { variable: variableKind },
        changes: [
          {
            path: changePath,
            previousValue: previousState,
            newValue: variableKind,
          },
        ],
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
