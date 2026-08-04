import { type PromptDatasource } from './types';

/** Origin reported to the assistant for all dashboard-prompt interactions. */
export const PROMPT_ORIGIN = 'grafana/dashboard-prompt';

/** The datasources the assistant may query, as a list for the planning instructions. */
export function formatDatasources(datasources: PromptDatasource[]): string {
  const maxListed = 50;
  const lines = datasources
    .slice(0, maxListed)
    .map((ds) => `- ${ds.name ?? ds.uid} (type: ${ds.type}, uid: ${ds.uid})`);
  if (datasources.length > maxListed) {
    lines.push(`- …and ${datasources.length - maxListed} more`);
  }
  return lines.length > 0 ? lines.join('\n') : '(no datasources available)';
}
