import Skeleton from 'react-loading-skeleton';

import {
  type ListAlertRuleSearchRulesV0Alpha1SearchResultsMetadata,
  type ListRecordingRuleSearchRulesV0Alpha1SearchResultsMetadata,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { Text } from '@grafana/ui';

import { type RuleKind } from '../shared/ruleKind';

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

  const formatted = new Intl.NumberFormat().format(total.count) + (total.isLowerBound ? '+' : '');

  return (
    <Text variant="bodySmall" color="secondary" element="p">
      {resultCountLabel(kind, total.count, formatted)}
    </Text>
  );
}

/** Reads the total from a search page's metadata; `totalHits` is typed as required but guarded, since the count is optional to show. */
export function toResultTotal(
  metadata:
    | ListAlertRuleSearchRulesV0Alpha1SearchResultsMetadata
    | ListRecordingRuleSearchRulesV0Alpha1SearchResultsMetadata
): ResultTotal | undefined {
  if (typeof metadata.totalHits !== 'number') {
    return undefined;
  }
  return { count: metadata.totalHits, isLowerBound: metadata.totalHitsRelation === 'lte' };
}

function resultCountLabel(kind: RuleKind, count: number, formatted: string): string {
  if (kind === 'alert') {
    return t('alerting.gma-rule-list.result-count.alert-rules', '', {
      count,
      formatted,
      defaultValue_one: '{{formatted}} alert rule',
      defaultValue_other: '{{formatted}} alert rules',
    });
  }
  return t('alerting.gma-rule-list.result-count.recording-rules', '', {
    count,
    formatted,
    defaultValue_one: '{{formatted}} recording rule',
    defaultValue_other: '{{formatted}} recording rules',
  });
}
