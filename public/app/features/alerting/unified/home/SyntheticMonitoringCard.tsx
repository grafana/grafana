import { t } from '@grafana/i18n';
import syntheticMonitoringSvg from 'img/synthetic_monitoring_logo.svg';

import AdCard from './AdCard';

const LINK =
  'https://grafana.com/auth/sign-up/create-user?redirectPath=synthetic-monitoring&src=oss-grafana&cnt=alerting-synthetic-monitoring';
const HELP_FLAG_SYNTHETIC_MONITORING = 0x0008;

export default function SyntheticMonitoringCard() {
  return (
    <AdCard
      title={t('alerting.home.synthetic-monitoring-card-title', 'Synthetic Monitoring')}
      description={t(
        'alerting.home.synthetic-monitoring-card-description',
        'Monitor critical user flows, websites, and APIs externally, from global locations.'
      )}
      href={LINK}
      logoUrl={syntheticMonitoringSvg}
      items={[
        t('alerting.home.synthetic-monitoring-card-item-1', 'Simulate end-to-end user journeys with browser checks.'),
        t(
          'alerting.home.synthetic-monitoring-card-item-2',
          'Run ping, DNS, HTTP/S, and TCP checks at every network layer.'
        ),
        t(
          'alerting.home.synthetic-monitoring-card-item-3',
          'Use 20+ global probes or private probes behind your firewall.'
        ),
        t(
          'alerting.home.synthetic-monitoring-card-item-4',
          'Track SLOs with built-in Prometheus-style alerts — right from the UI.'
        ),
      ]}
      helpFlag={HELP_FLAG_SYNTHETIC_MONITORING}
    />
  );
}
