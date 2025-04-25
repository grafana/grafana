import Skeleton from 'react-loading-skeleton';

import { t } from 'app/core/internationalization';
import { GrafanaRuleIdentifier } from 'app/types/unified-alerting';

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
    />
  );
}

export function RulerRuleLoadingError({ ruleIdentifier }: { ruleIdentifier: GrafanaRuleIdentifier }) {
  return (
    <ListItem
      title={ruleIdentifier.uid}
      description={t('alerting.rule-list.rulerrule-loading-error', 'Failed to load the rule')}
      data-testid="ruler-rule-loading-error"
    />
  );
}
