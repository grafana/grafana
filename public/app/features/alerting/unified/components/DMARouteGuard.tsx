import { type ReactNode } from 'react';

import { type NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { TextLink } from '@grafana/ui';

import { AlertWarning } from '../AlertWarning';
import { DMAStatus, useDMAStatus } from '../hooks/useDMAStatus';
import { getAlertRulesNavId } from '../navigation/useAlertRulesNav';
import { prometheusAlertingPlugin } from '../utils/prometheusNavigation';

import { AlertingPageWrapper } from './AlertingPageWrapper';

interface DMARouteGuardProps {
  children: ReactNode;
  /**
   * Where to send the user when the plugin owns DMA. Supplying this marks the route as data
   * source-managed; omit it for Grafana-managed routes and for requests the caller has already
   * decided to refuse, so a denial in `children` is not pre-empted by the handoff.
   */
  pluginDestination?: ReactNode;
  unavailableDescription: ReactNode;
  pageNav?: NavModelItem;
}

export function DMARouteGuard({ children, pluginDestination, unavailableDescription, pageNav }: DMARouteGuardProps) {
  const dmaStatus = useDMAStatus();

  if (!pluginDestination) {
    return children;
  }

  if (dmaStatus.status === DMAStatus.Loading) {
    return <AlertingPageWrapper pageNav={pageNav} navId={getAlertRulesNavId()} isLoading={true} />;
  }

  if (dmaStatus.status === DMAStatus.ManagedByPlugin) {
    return pluginDestination;
  }

  if (dmaStatus.status === DMAStatus.NotAvailable) {
    return (
      <AlertingPageWrapper pageNav={pageNav} navId={getAlertRulesNavId()}>
        <AlertWarning
          title={t(
            'alerting.dma-route-guard.data-source-managed-unavailable',
            'Data source-managed alerting is unavailable'
          )}
        >
          {unavailableDescription}{' '}
          <Trans i18nKey="alerting.dma-route-guard.install-or-enable-plugin">
            <TextLink href={prometheusAlertingPlugin.install}>
              Install or enable the Prometheus Alerting plugin
            </TextLink>{' '}
            to manage it.
          </Trans>
        </AlertWarning>
      </AlertingPageWrapper>
    );
  }

  return children;
}
