import { t } from '@grafana/i18n';
import assertsSvg from 'img/asserts_logo.svg';

import AdCard, { AdCardProps } from './AdCard';

const LINK = 'https://grafana.com/auth/sign-up/create-user?redirectPath=asserts&src=oss-grafana&cnt=alerting-asserts';
const HELP_FLAG_ASSERTS = 0x0020;

export function getAssertsCardConfig(): AdCardProps {
  return {
    title: t('alerting.home.asserts-card-title', 'Grafana Knowledge Graph'),
    description: t(
      'alerting.home.asserts-card-description',
      'Find and fix issues faster with automated root cause analysis for your services.'
    ),
    href: LINK,
    logoUrl: assertsSvg,
    items: [
      t('alerting.home.asserts-card-item-1', 'Automatically map services and their dependencies.'),
      t('alerting.home.asserts-card-item-2', 'Detect anomalies and surface root causes without manual queries.'),
      t('alerting.home.asserts-card-item-3', 'Correlate metrics, logs, and traces in a unified workflow.'),
      t('alerting.home.asserts-card-item-4', 'Reduce mean time to resolution with AI-assisted investigation.'),
    ],
    helpFlag: HELP_FLAG_ASSERTS,
  };
}

export default function AssertsCard() {
  return <AdCard {...getAssertsCardConfig()} />;
}
