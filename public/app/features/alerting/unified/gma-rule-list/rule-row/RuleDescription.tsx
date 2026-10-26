import { Text, Tooltip } from '@grafana/ui';

interface RuleDescriptionProps {
  lastError?: string;
  /** Alert rules only; omit for recording rules. */
  summary?: string;
}

/** One-line description below the title: error (red) if present, else summary (secondary). Always renders; let the caller guard on presence. */
export function RuleDescription({ lastError, summary }: RuleDescriptionProps) {
  if (lastError) {
    return (
      <Tooltip content={lastError} placement="top">
        <Text variant="bodySmall" color="error" weight="light" truncate element="p" aria-label={lastError}>
          {lastError}
        </Text>
      </Tooltip>
    );
  }
  if (summary) {
    return (
      <Tooltip content={summary} placement="top">
        <Text variant="bodySmall" color="secondary" truncate element="p" aria-label={summary}>
          {summary}
        </Text>
      </Tooltip>
    );
  }
  return null;
}
