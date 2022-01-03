import { Labels } from '@grafana/data';

/**
 * Replace labels in a string.  Used for loki+prometheus legend formats
 *
 * For many years, this was implemented as:
 *   const aliasRegex = /\{\{\s*(.+?)\s*\}\}/g;
 */
export function renderLegendFormat(aliasPattern: string, aliasData: Labels): string {
  let idx = aliasPattern ? aliasPattern.indexOf('{{') : -1;
  while (idx >= 0 && aliasData) {
    let edx = aliasPattern.indexOf('}}', idx + 1);
    if (idx > edx) {
      return aliasPattern;
    }

    const key = aliasPattern.substring(idx + 2, edx).trim();
    const val = aliasData[key];
    if (val != null) {
      aliasPattern = aliasPattern.substring(0, idx) + val + aliasPattern.substring(edx + 2);
    }
    idx = aliasPattern.indexOf('{{', idx + 2);
  }
  return aliasPattern;
}
