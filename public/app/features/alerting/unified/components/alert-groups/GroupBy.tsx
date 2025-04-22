import { uniq } from 'lodash';

import { SelectableValue } from '@grafana/data';
import { Icon, Label, MultiSelect, Tooltip } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { AlertmanagerGroup } from 'app/plugins/datasource/alertmanager/types';

import { isPrivateLabelKey } from '../../utils/labels';

interface Props {
  groups: AlertmanagerGroup[];
  groupBy: string[];
  onGroupingChange: (keys: string[]) => void;
}

export const GroupBy = ({ groups, groupBy, onGroupingChange }: Props) => {
  const labelKeyOptions = uniq(groups.flatMap((group) => group.alerts).flatMap(({ labels }) => Object.keys(labels)))
    .filter((label) => !isPrivateLabelKey(label)) // Filter out private labels
    .map<SelectableValue>((key) => ({
      label: key,
      value: key,
    }));

  return (
    <div data-testid={'group-by-container'}>
      <Label>
        <span>
          <Trans i18nKey="alerting.group-by.custom-group-by">Custom group by</Trans>&nbsp;
        </span>
        <Tooltip
          content={
            <div>
              <Trans i18nKey="alerting.group-by.tooltip-group-by">
                Group notifications using a different combination of labels. This option can help validate the grouping
                settings of your notification policies.
              </Trans>
            </div>
          }
        >
          <Icon name="info-circle" size="sm" />
        </Tooltip>
      </Label>
      <MultiSelect
        aria-label={t('alerting.group-by.aria-label-group-by-label-keys', 'Group by label keys')}
        value={groupBy}
        placeholder={t('alerting.group-by.placeholder-group-by', 'Group by')}
        prefix={<Icon name={'tag-alt'} />}
        onChange={(items) => {
          onGroupingChange(items.map(({ value }) => value as string));
        }}
        options={labelKeyOptions}
        width={34}
      />
    </div>
  );
};
