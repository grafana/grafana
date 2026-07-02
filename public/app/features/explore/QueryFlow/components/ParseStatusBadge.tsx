import { type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, type BadgeColor } from '@grafana/ui';

import { type QueryFlowStatus } from '../model/types';

interface Props {
  status: QueryFlowStatus;
}

export function ParseStatusBadge({ status }: Props) {
  if (status === 'valid' || status === 'empty') {
    return null;
  }

  const config: Record<'partial' | 'stale' | 'unsupported', { color: BadgeColor; icon: IconName; text: string }> = {
    partial: {
      color: 'orange',
      icon: 'exclamation-triangle',
      text: t('explore.query-flow.status.partial', 'Partially parsed'),
    },
    stale: {
      color: 'blue',
      icon: 'clock-nine',
      text: t('explore.query-flow.status.stale', 'Showing last valid query'),
    },
    unsupported: {
      color: 'red',
      icon: 'exclamation-circle',
      text: t('explore.query-flow.status.unsupported', 'Unsupported data source'),
    },
  };

  const { color, icon, text } = config[status];
  return <Badge color={color} icon={icon} text={text} />;
}
