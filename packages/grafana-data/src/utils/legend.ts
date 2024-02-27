import { Labels } from '../types';

/** replace labels in a string.  Used for loki+prometheus legend formats */
export function renderLegendFormat(aliasPattern: string, aliasData: Labels): string {
  const aliasRegex = /\{\{\s*(.+?)\s*\}\}/g;
  console.log(aliasPattern);
  console.log(aliasData);
  return aliasPattern.replace(aliasRegex, (_, g1) => (aliasData[g1] ? aliasData[g1] : g1));
}
