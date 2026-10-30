import { Text } from '@grafana/ui';

interface RuleDescriptionProps {
  lastError?: string;
  /** Alert rules only; omit for recording rules. */
  summary?: string;
}

/** One-line description below the title: error (red) if present, else summary (secondary). Always renders; let the caller guard on presence. */
export function RuleDescription({ lastError, summary }: RuleDescriptionProps) {
  if (lastError) {
    return (
      <Text variant="bodySmall" color="error" weight="light" truncate element="p">
        {lastError}
      </Text>
    );
  }
  if (summary) {
    return (
      <Text variant="bodySmall" color="secondary" truncate element="p">
        {summary}
      </Text>
    );
  }
  return null;
}
