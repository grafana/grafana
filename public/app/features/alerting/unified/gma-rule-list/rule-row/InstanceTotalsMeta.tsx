import { t } from '@grafana/i18n';

import { MetaItem } from '../shared/MetaItem';

/** Instance counts per state; a state the API did not return is absent, which is not the same as 0. */
export interface InstanceTotals {
  healthy?: number;
  firing?: number;
  pending?: number;
  recovering?: number;
  noData?: number;
  error?: number;
}

interface InstanceTotalsMetaProps {
  totals: InstanceTotals;
}

function describeTotals({ healthy, firing, pending, recovering, noData, error }: InstanceTotals): string[] {
  const entries: Array<string | undefined> = [
    healthy === undefined
      ? undefined
      : t('alerting.gma-rule-list.shared.totals-healthy', '{{total}} healthy', { total: healthy }),
    firing === undefined
      ? undefined
      : t('alerting.gma-rule-list.shared.totals-firing', '{{total}} firing', { total: firing }),
    pending === undefined
      ? undefined
      : t('alerting.gma-rule-list.shared.totals-pending', '{{total}} pending', { total: pending }),
    recovering === undefined
      ? undefined
      : t('alerting.gma-rule-list.shared.totals-recovering', '{{total}} recovering', { total: recovering }),
    noData === undefined
      ? undefined
      : t('alerting.gma-rule-list.shared.totals-no-data', '{{total}} no data', { total: noData }),
    error === undefined
      ? undefined
      : t('alerting.gma-rule-list.shared.totals-error', '{{total}} error', { total: error }),
  ];
  return entries.filter((entry): entry is string => entry !== undefined);
}

/** Every instance count the API returned, each labelled with its state; nothing when it returned none. */
export function InstanceTotalsMeta({ totals }: InstanceTotalsMetaProps) {
  const parts = describeTotals(totals);

  if (parts.length === 0) {
    return null;
  }

  return <MetaItem icon="layers-alt">{parts.join(', ')}</MetaItem>;
}
