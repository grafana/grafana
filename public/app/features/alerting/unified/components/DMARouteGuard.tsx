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
  isDataSourceManaged: boolean;
  pluginPage?: ReactNode;
  unavailableDescription: ReactNode;
  pageNav?: NavModelItem;
}

export function DMARouteGuard({
  children,
  isDataSourceManaged,
  pluginPage,
  unavailableDescription,
  pageNav,
}: DMARouteGuardProps) {
  const dmaStatus = useDMAStatus();
  const needsDMAStatus = isDataSourceManaged || Boolean(pluginPage);

  if (!needsDMAStatus) {
    return children;
  }

  if (dmaStatus.status === DMAStatus.Loading) {
    return <AlertingPageWrapper pageNav={pageNav} navId={getAlertRulesNavId()} isLoading={true} />;
  }

  if (dmaStatus.status === DMAStatus.ManagedByPlugin && pluginPage) {
    return pluginPage;
  }

  if (dmaStatus.status === DMAStatus.NotAvailable && isDataSourceManaged) {
    return (
      <AlertingPageWrapper pageNav={pageNav} navId={getAlertRulesNavId()}>
        <AlertWarning
          title={t(
            'alerting.dma-route-guard.data-source-managed-unavailable',
            'Data source-managed alerting is unavailable'
          )}
        >
          {unavailableDescription}{' '}
          <Trans i18nKey="alerting.dma-route-guard.install-plugin">
            <TextLink href={prometheusAlertingPlugin.install}>Install the Prometheus Alerting plugin</TextLink> to
            manage it.
          </Trans>
        </AlertWarning>
      </AlertingPageWrapper>
    );
  }

  return children;
}
