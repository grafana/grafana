import { t } from '@grafana/i18n';

import { OrangeBadge } from './OrangeBadge';

export function CloudEnterpriseBadge() {
  return <OrangeBadge text={t('cloud-enterprise-feature-badge', 'Cloud & Enterprise')} />;
}
