import { Labels } from '@grafana/data';

/** replace labels in a string.  Used for loki+prometheus legend formats */
export function renderLegendFormat(aliasPattern: string, aliasData: Labels): string {
  const aliasRegex = /\{\{([^\{\}]+?)\}\}/g;
  return aliasPattern.replace(aliasRegex, (_, g1: string) => {
    const trimmedMatch = g1.trim();
    return aliasData[trimmedMatch] ?? trimmedMatch;
  });
}
