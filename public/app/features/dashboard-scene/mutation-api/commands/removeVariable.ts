/**
 * REMOVE_VARIABLE command
 *
 * Remove a template variable from the dashboard by name.
 */

import { type z } from 'zod';

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

const removeVariablePayloadSchema = payloads.removeVariable;

export type RemoveVariablePayload = z.infer<typeof removeVariablePayloadSchema>;

export const removeVariableCommand: MutationCommand<RemoveVariablePayload> = {
  name: 'REMOVE_VARIABLE',
  description: payloads.removeVariable.description ?? '',

  payloadSchema: payloads.removeVariable,
  permission: requiresEdit,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    const { name, parentPath } = payload;
    const effectiveParentPath = getEffectiveVariableParentPath(parentPath);
    const sectionVariablesEnabled = isSectionVariablesFeatureEnabled();
    enterEditModeIfNeeded(scene);

    try {
      let scope;
      if (effectiveParentPath === '/') {
        if (!dashboardHasVariableNamed(scene, name)) {
          if (!sectionVariablesEnabled) {
            throw new Error(`Variable '${name}' not found`);
          }
          const sectionPaths = findSectionPathsContainingVariable(scene, name);
          if (sectionPaths.length === 0) {
            throw new Error(`Variable '${name}' not found`);
          }
          throw new Error(
            `Variable '${name}' is not on the dashboard. Pass parentPath to remove a section variable (e.g. "${sectionPaths[0]}").`
          );
        }
        scope = resolveVariableScope(scene, '/');
      } else {
        scope = resolveVariableScope(scene, effectiveParentPath);
      }

      const { scopeOwner, layoutPathPrefix } = scope;

      const variables = scopeOwner.state.$variables;
      if (!variables) {
        throw new Error(`Variable '${name}' not found`);
      }

      const variable = variables.getByName(name);
      if (!variable) {
        throw new Error(`Variable '${name}' not found`);
      }

      const previousState = variable.state;

      const updatedVariables = getScopeVariableArray(scopeOwner).filter((v) => v.state.name !== name);
      replaceScopeVariableSet(scopeOwner, updatedVariables);

      const changePath = buildVariableChangePath(layoutPathPrefix, name);

      return {
        success: true,
        data: { name },
        changes: [{ path: changePath, previousValue: previousState, newValue: null }],
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
