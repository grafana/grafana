import { css } from '@emotion/css';
import { uniq } from 'lodash';

import { type SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Icon, Label, MultiSelect, Tooltip, useStyles2 } from '@grafana/ui';
import { type AlertmanagerGroup } from 'app/plugins/datasource/alertmanager/types';

const collator = new Intl.Collator('en', { sensitivity: 'accent' });

interface Props {
  groups: AlertmanagerGroup[];
  receivers: string[];
  onReceiversChange: (receivers: string[]) => void;
}

export const ReceiverFilter = ({ groups, receivers, onReceiversChange }: Props) => {
  const styles = useStyles2(getStyles);
  const receiverOptions = uniq(groups.map((group) => group.receiver.name))
    .map<SelectableValue<string>>((receiverName) => ({
      label: receiverName === 'NONE' ? t('alerting.receiver-filter.no-grouping', 'No grouping') : receiverName,
      value: receiverName,
    }))
    .sort((a, b) => collator.compare(a.label || '', b.label || ''));

  return (
    <div data-testid={'receiver-filter-container'} className={styles.wrapper}>
      <Label>
        <span>
          <Trans i18nKey="alerting.receiver-filter.contact-point">Contact point</Trans>&nbsp;
        </span>
        <Tooltip
          content={
            <Trans i18nKey="alerting.receiver-filter.tooltip-contact-point">
              Filter notifications by the contact point they are being delivered to.
            </Trans>
          }
        >
          <Icon name="info-circle" size="sm" />
        </Tooltip>
      </Label>
      <MultiSelect<string>
        aria-label={t('alerting.receiver-filter.aria-label-contact-points', 'Filter by contact points')}
        value={receivers}
        placeholder={t('alerting.receiver-filter.placeholder-contact-point', 'Filter by contact point')}
        prefix={<Icon name="at" />}
        onChange={(items) => {
          onReceiversChange(items.map(({ value }) => value).filter((v): v is string => v !== undefined));
        }}
        options={receiverOptions}
        width={32}
      />
    </div>
  );
};

const getStyles = () => ({
  wrapper: css({
    minWidth: 0,
    flex: '1 1 0',
  }),
});
