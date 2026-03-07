import { t } from '@grafana/i18n';
import sloSvg from 'img/slo_logo.svg';

import AdCard, { AdCardProps } from './AdCard';

const LINK = 'https://grafana.com/auth/sign-up/create-user?redirectPath=slo&src=oss-grafana&cnt=alerting-slo';
const HELP_FLAG_SLO = 0x0040;

export function getSloCardConfig(): AdCardProps {
  return {
    title: t('alerting.home.slo-card-title', 'Grafana SLO'),
    description: t(
      'alerting.home.slo-card-description',
      'Define, track, and alert on Service Level Objectives directly in Grafana.'
    ),
    href: LINK,
    logoUrl: sloSvg,
    items: [
      t('alerting.home.slo-card-item-1', 'Create SLOs from any Prometheus-compatible metric source.'),
      t('alerting.home.slo-card-item-2', 'Visualize error budgets and burn rates out of the box.'),
      t('alerting.home.slo-card-item-3', 'Get automatic alerting when error budgets are at risk.'),
      t('alerting.home.slo-card-item-4', 'Track reliability goals alongside your existing dashboards.'),
    ],
    helpFlag: HELP_FLAG_SLO,
  };
}

export default function SLOCard() {
  return <AdCard {...getSloCardConfig()} />;
}
