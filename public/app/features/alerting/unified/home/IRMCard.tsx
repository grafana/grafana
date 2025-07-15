import { t } from '@grafana/i18n';
import irmSvg from 'img/irm_logo.svg';

import AdCard from './AdCard';

const LINK = 'https://grafana.com/auth/sign-up/create-user?redirectPath=irm&src=oss-grafana&cnt=alerting-irm';
const HELP_FLAG_IRM = 0x0010;

export default function IRMCard() {
  return (
    <AdCard
      title={t('alerting.home.irm-card-title', 'Incident response and management')}
      description={t(
        'alerting.home.irm-card-description',
        'Unify on-call, alerting, and incident response with Grafana Cloud IRM.'
      )}
      href={LINK}
      logoUrl={irmSvg}
      items={[
        t('alerting.home.irm-card-item-1', 'Manage on-call schedules with your calendar or Terraform.'),
        t('alerting.home.irm-card-item-2', 'Respond to incidents via web, app, Slack, or other channels.'),
        t('alerting.home.irm-card-item-3', 'Pinpoint root causes with AI-powered Grafana SIFT.'),
        t('alerting.home.irm-card-item-4', 'Analyze past incidents to improve response and resilience.'),
      ]}
      helpFlag={HELP_FLAG_IRM}
    />
  );
}
