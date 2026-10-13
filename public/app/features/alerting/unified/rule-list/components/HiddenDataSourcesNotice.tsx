import { Trans, t } from '@grafana/i18n';
import { Button, Icon } from '@grafana/ui';

import { InlineNotice } from './InlineNotice';

interface Props {
  count: number;
  onShowAll?: () => void;
}

export function HiddenDataSourcesNotice({ count, onShowAll }: Props) {
  if (count === 0) {
    return null;
  }

  return (
    <InlineNotice
      icon={<Icon name="info-circle" size="sm" />}
      action={
        onShowAll && (
          <Button variant="secondary" fill="text" size="sm" onClick={onShowAll}>
            <Trans i18nKey="alerting.rule-list.hidden-empty-data-sources-show-all">Show all</Trans>
          </Button>
        )
      }
    >
      {t('alerting.rule-list.hidden-empty-data-sources', '', {
        count,
        defaultValue_one: '{{count}} data source with no rules is hidden',
        defaultValue_other: '{{count}} data sources with no rules are hidden',
      })}
    </InlineNotice>
  );
}
