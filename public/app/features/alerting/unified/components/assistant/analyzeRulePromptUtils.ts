/**
 * Shared, API-independent helpers for building Assistant "Analyze rule" prompts and context.
 * Used by both the legacy Prometheus-shaped AnalizeRuleButton and the Kubernetes-resource
 * AnalyzeK8sRuleButton, so the two prompt styles stay in sync without either one depending on
 * the other's rule shape.
 */

/** Formats a label set as `key="value", key2="value2"` for inclusion in a prompt string. */
export function formatLabelsForPrompt(labels?: Record<string, string | undefined>): string {
  if (!labels) {
    return '';
  }

  return Object.entries(labels)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}="${value}"`)
    .join(', ');
}
