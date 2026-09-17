import Skeleton from 'react-loading-skeleton';

import { StateIcon } from '@grafana/alerting/unstable';

import { ListItem } from './ListItem';
import { RuleActionsSkeleton } from './RuleActionsSkeleton';

export function AlertRuleListItemSkeleton() {
  return (
    <ListItem
      title={<Skeleton width={64} />}
      icon={<StateIcon isPaused={false} />}
      description={<Skeleton width={256} />}
      actions={<RuleActionsSkeleton />}
      data-testid="alert-rule-list-item-loader"
      aria-disabled={true}
    />
  );
}
