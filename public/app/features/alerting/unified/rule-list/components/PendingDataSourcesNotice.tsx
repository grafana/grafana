import { t } from '@grafana/i18n';
import { Spinner } from '@grafana/ui';

import { InlineNotice } from './InlineNotice';

interface Props {
  count: number;
}

export function PendingDataSourcesNotice({ count }: Props) {
  if (count === 0) {
    return null;
  }

  return (
    <InlineNotice icon={<Spinner size="sm" inline />}>
      {t('alerting.rule-list.checking-data-sources', '', {
        count,
        defaultValue_one: 'Checking {{count}} more data source',
        defaultValue_other: 'Checking {{count}} more data sources',
      })}
    </InlineNotice>
  );
}
