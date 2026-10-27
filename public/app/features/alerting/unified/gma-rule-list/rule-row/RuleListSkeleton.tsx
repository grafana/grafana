import Skeleton from 'react-loading-skeleton';

import { t } from '@grafana/i18n';

import { RuleListItem } from './RuleListItem';
import { RuleRowList } from './RuleRowList';

/** Stands in for a page of rule rows while it loads. */
export function RuleListSkeleton() {
  return (
    <RuleRowList aria-busy aria-label={t('alerting.gma-rule-list.shared.loading-rules', 'Loading rules')}>
      <RuleListItemSkeletons />
    </RuleRowList>
  );
}

function RuleListItemSkeletons() {
  return Array.from({ length: SKELETON_ROWS }, (_, index) => (
    <RuleListItem
      key={index}
      aria-hidden
      icon={<Skeleton circle width={15} height={15} />}
      title={<Skeleton width={160} />}
      meta={[<Skeleton key="meta" width={96} />]}
    />
  ));
}

const SKELETON_ROWS = 3;
