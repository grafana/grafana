import { AlertLabels } from '@grafana/alerting/unstable';
import { t } from '@grafana/i18n';
import { Text, Tooltip } from '@grafana/ui';

import { MetaItem } from '../shared/MetaItem';

const GRAFANA_ORIGIN_LABEL = '__grafana_origin';

interface LabelsMetaProps {
  labels: Record<string, string>;
}

/** Label count whose tooltip lists the labels. The origin label is shown as a badge instead, so it is not counted. */
export function LabelsMeta({ labels }: LabelsMetaProps) {
  const displayLabels = Object.fromEntries(Object.entries(labels).filter(([key]) => key !== GRAFANA_ORIGIN_LABEL));
  const count = Object.keys(displayLabels).length;

  if (count === 0) {
    return null;
  }

  return (
    <MetaItem icon="tag-alt">
      <Tooltip content={<AlertLabels labels={displayLabels} size="sm" />} interactive placement="right">
        <Text variant="bodySmall" color="primary">
          {t('alerting.gma-rule-list.shared.label-count', '', {
            count,
            defaultValue_one: '{{count}} label',
            defaultValue_other: '{{count}} labels',
          })}
        </Text>
      </Tooltip>
    </MetaItem>
  );
}
