/**
 * VALIDATE_DASHBOARD command
 *
 * Runs deterministic checks over the open dashboard and reports the issues it
 * finds. Currently: template variables referenced by queries/panels/links that
 * are not defined on the dashboard (built-in variables excluded). Read-only, no
 * permissions required.
 *
 * Exposed so tools (e.g. Grafana Assistant) can self-check a dashboard they
 * built and fix problems before finishing — the same check the wizard runs as
 * a post-build backstop.
 */

import { getDashboardValidationIssues } from '../../validation/getDashboardValidationIssues';

import { payloads } from './schemas';
import { readOnly, type MutationCommand } from './types';

export const validateDashboardCommand: MutationCommand<Record<string, never>> = {
  name: 'VALIDATE_DASHBOARD',
  description: payloads.validateDashboard.description ?? '',

  payloadSchema: payloads.validateDashboard,
  permission: readOnly,
  readOnly: true,

  handler: async (_payload, context) => {
    try {
      return {
        success: true,
        data: getDashboardValidationIssues(context.scene),
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
