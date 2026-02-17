import { useEffect, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { config, useAppPluginInstalled } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';
import { Alert, LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

const userStorage = new UserStorage('advisor-redirect-notice');

export function AdvisorRedirectNotice() {
  const hasAdminRights = contextSrv.hasRole('Admin') || contextSrv.isGrafanaAdmin;
  const [showNotice, setShowNotice] = useState(false);
  const { value: isAdvisorInstalled } = useAppPluginInstalled('grafana-advisor-app');

  const canUseAdvisor = hasAdminRights && config.featureToggles.grafanaAdvisor && Boolean(isAdvisorInstalled);

  useEffect(() => {
    if (!canUseAdvisor) {
      return;
    }

    userStorage.getItem('showNotice').then((showNotice) => {
      if (showNotice !== 'false') {
        setShowNotice(true);
      }
    });
  }, [canUseAdvisor]);

  if (!showNotice) {
    return <></>;
  }

  return (
    <Alert
      severity="info"
      title={t(
        'connections.advisor-redirect-notice.title',
        'Try the new Advisor to uncover potential issues with your data sources and plugins'
      )}
      onRemove={() => {
        userStorage.setItem('showNotice', 'false');
        setShowNotice(false);
      }}
    >
      <LinkButton
        aria-label={t('connections.advisor-redirect-notice.aria-label-link-to-advisor', 'Link to Advisor')}
        icon="arrow-right"
        href="/a/grafana-advisor-app"
        variant="primary"
      >
        <Trans i18nKey="connections.advisor-redirect-notice.go-to-advisor">Go to Advisor</Trans>
      </LinkButton>
    </Alert>
  );
}
