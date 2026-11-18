import { omitBy } from 'lodash';

import { AlertLabels } from '@grafana/alerting/unstable';
import { t } from '@grafana/i18n';
import { Icon, Stack, Text, Tooltip } from '@grafana/ui';
import { type Labels } from 'app/types/unified-alerting-dto';

import { isPrivateLabelKey } from '../../utils/labels';

interface RuleLabelsProps {
  labels: Labels;
}

/** Private labels such as `__grafana_origin` are left out of both the count and the tooltip. */
export function RuleLabels({ labels }: RuleLabelsProps) {
  const publicLabels = omitBy(labels, (_, key) => isPrivateLabelKey(key));
  const count = Object.keys(publicLabels).length;
  if (count === 0) {
    return null;
  }

  const text = t('alerting.gma-rule-list.labels', '', {
    count,
    formatted: String(count),
    defaultValue_one: '{{formatted}} label',
    defaultValue_other: '{{formatted}} labels',
  });

  return (
    <Tooltip content={<AlertLabels labels={publicLabels} size="sm" />} placement="right" interactive>
      <Stack direction="row" alignItems="center" gap={0.5}>
        <Icon name="tag-alt" size="xs" />
        <Text variant="bodySmall" color="primary">
          {text}
        </Text>
      </Stack>
    </Tooltip>
  );
}
