import { SemVer } from 'semver';

import { logWarning } from '@grafana/runtime';

export const LLM_PLUGIN_ID = 'grafana-llm-app';
export const LLM_PLUGIN_ROUTE = `/api/plugins/${LLM_PLUGIN_ID}`;

// The LLM app was at version 0.2.0 before we added the health check.
// If the health check fails, or the details don't exist on the response,
// we should assume it's this older version.
export let LLM_PLUGIN_VERSION = new SemVer('0.2.0');

export function setLLMPluginVersion(version: string) {
  try {
    LLM_PLUGIN_VERSION = new SemVer(version);
  } catch (e) {
    logWarning('Failed to parse version of grafana-llm-app; assuming old version is present.');
  }
}
