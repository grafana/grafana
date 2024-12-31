import Skeleton from 'react-loading-skeleton';

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
