import Skeleton from 'react-loading-skeleton';

import { PromRuleDTO } from 'app/types/unified-alerting-dto';

import { ActionsLoader } from './ActionsLoader';
import { ListItem } from './ListItem';
import { RuleListIcon } from './RuleListIcon';

export function AlertRuleListItemLoader() {
  return (
    <ListItem
      title={<Skeleton width={64} />}
      icon={<RuleListIcon isPaused={false} />}
      description={<Skeleton width={256} />}
      actions={<ActionsLoader />}
      data-testid="alert-rule-list-item-loader"
    />
  );
}

export function RulerRuleLoadingError({ rule }: { rule: PromRuleDTO }) {
  return <ListItem title={rule.name} description="Failed to load rule" data-testid="ruler-rule-loading-error" />;
}
