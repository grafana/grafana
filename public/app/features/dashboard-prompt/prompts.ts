import { type PromptDatasource } from './types';

/** Origin reported to the assistant for all dashboard-prompt interactions. */
export const PROMPT_ORIGIN = 'grafana/dashboard-prompt';

/**
 * Cap on how many datasources `formatDatasources` lists by uid. Exported so
 * callers can tell whether a given scope was truncated, since a truncated
 * list can no longer back a "no others exist" claim (see handoff.ts).
 */
export const MAX_LISTED_DATASOURCES = 50;

/** The datasources the assistant may query, as a list for the planning instructions. */
export function formatDatasources(datasources: PromptDatasource[]): string {
  const lines = datasources
    .slice(0, MAX_LISTED_DATASOURCES)
    .map((ds) => `- ${ds.name ?? ds.uid} (type: ${ds.type}, uid: ${ds.uid})`);
  if (datasources.length > MAX_LISTED_DATASOURCES) {
    lines.push(`- …and ${datasources.length - MAX_LISTED_DATASOURCES} more not shown here`);
  }
  return lines.length > 0 ? lines.join('\n') : '(no datasources available)';
}
