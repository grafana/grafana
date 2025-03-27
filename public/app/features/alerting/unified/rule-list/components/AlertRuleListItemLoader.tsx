import Skeleton from 'react-loading-skeleton';

import { t } from 'app/core/internationalization';
import { PromRuleDTO } from 'app/types/unified-alerting-dto';

import { ListItem } from './ListItem';
import { RuleActionsSkeleton } from './RuleActionsSkeleton';
import { RuleListIcon } from './RuleListIcon';

export function AlertRuleListItemLoader() {
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

export function RulerRuleLoadingError({ rule }: { rule: PromRuleDTO }) {
  return (
    <ListItem
      title={rule.name}
      description={t('alerting.rule-list.rulerrule-loading-error', 'Failed to load the rule')}
      data-testid="ruler-rule-loading-error"
    />
  );
}
