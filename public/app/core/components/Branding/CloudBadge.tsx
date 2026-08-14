import { t } from '@grafana/i18n';

import { OrangeBadge } from './OrangeBadge';

export function CloudBadge() {
  return <OrangeBadge text={t('cloud-feature-badge', 'Cloud')} />;
}
