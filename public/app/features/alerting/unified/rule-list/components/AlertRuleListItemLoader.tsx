import Skeleton from 'react-loading-skeleton';

import { t } from '@grafana/i18n';
import { GrafanaRuleIdentifier } from 'app/types/unified-alerting';

import { stringifyErrorLike } from '../../utils/misc';

import { ListItem } from './ListItem';
import { RuleActionsSkeleton } from './RuleActionsSkeleton';
import { RuleListIcon } from './RuleListIcon';

export function AlertRuleListItemSkeleton() {
  return (
    <ListItem
      title={<Skeleton width={64} />}
      icon={<RuleListIcon isPaused={false} />}
      description={<Skeleton width={256} />}
      actions={<RuleActionsSkeleton />}
      data-testid="alert-rule-list-item-loader"
      aria-disabled={true}
    />
  );
}

export function RulerRuleLoadingError({
  ruleIdentifier,
  error,
}: {
  ruleIdentifier: GrafanaRuleIdentifier;
  error?: unknown;
}) {
  const errorMessage = error
    ? stringifyErrorLike(error)
    : t('alerting.rule-list.rulerrule-loading-error', 'Failed to load the rule');

  return <ListItem title={ruleIdentifier.uid} description={errorMessage} data-testid="ruler-rule-loading-error" />;
}
