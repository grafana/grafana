import Skeleton from 'react-loading-skeleton';

import { Text } from '@grafana/ui';

import { type RuleKind, ruleCountLabel } from '../shared/ruleKind';

export interface ResultTotal {
  count: number;
  /** `lte` means the backend reported a lower bound rather than an exact count. */
  isLowerBound: boolean;
}

interface ResultCountProps {
  kind: RuleKind;
  /** Absent when the response carried no total: nothing is shown rather than a count of loaded rows. */
  total?: ResultTotal;
  isLoading?: boolean;
}

export function ResultCount({ kind, total, isLoading = false }: ResultCountProps) {
  if (isLoading) {
    return <Skeleton width={96} />;
  }
  if (total === undefined) {
    return null;
  }

  return (
    <Text variant="bodySmall" color="secondary" element="p">
      {ruleCountLabel(kind, total.count, total.isLowerBound)}
    </Text>
  );
}
