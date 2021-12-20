import { Labels } from '@grafana/data';

/** replace labels in a string.  Used for loki+prometheus legend formats */
export function renderLegendFormat(aliasPattern: string, aliasData: Labels): string {
  // Negative lookbehind is to avoid https://github.com/github/codeql/blob/ddd4ccbb4b39adf3c2427088f4876432202c4eaa/javascript/ql/src/Performance/PolynomialReDoS.ql
  const aliasRegex = /\{\{\s*(.+?)(?<!\s)\s*\}\}/g;
  return aliasPattern.replace(aliasRegex, (_, g1) => (aliasData[g1] ? aliasData[g1] : g1));
}
