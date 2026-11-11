import { AlertLabels } from '@grafana/alerting/unstable';
import { t } from '@grafana/i18n';
import { Icon, Stack, Text, Tooltip } from '@grafana/ui';
import { type Labels } from 'app/types/unified-alerting-dto';

import { labelsSize } from '../../utils/labels';

interface RuleLabelsProps {
  labels: Labels;
}

export function RuleLabels({ labels }: RuleLabelsProps) {
  const count = labelsSize(labels);
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
    <Tooltip content={<AlertLabels labels={labels} size="sm" />} placement="right" interactive>
      <Stack direction="row" alignItems="center" gap={0.5}>
        <Icon name="tag-alt" size="xs" />
        <Text variant="bodySmall" color="primary">
          {text}
        </Text>
      </Stack>
    </Tooltip>
  );
}
