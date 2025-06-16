import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';
import { Alert, LinkButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';

const getStyles = (theme: GrafanaTheme2) => ({
  alertContent: css({
    display: 'flex',
    flexDirection: 'row',
    padding: 0,
    justifyContent: 'space-between',
    alignItems: 'center',
  }),
  alertParagraph: css({
    margin: theme.spacing(0, 1, 0, 0),
    lineHeight: theme.spacing(theme.components.height.sm),
  }),
});
const userStorage = new UserStorage('advisor-redirect-notice');

export function AdvisorRedirectNotice() {
  const styles = useStyles2(getStyles);
  const hasAdminRights = contextSrv.hasRole('Admin') || contextSrv.isGrafanaAdmin;
  const [showNotice, setShowNotice] = useState(false);

  const canUseAdvisor = hasAdminRights && config.featureToggles.grafanaAdvisor && !!config.apps['grafana-advisor-app'];

  useEffect(() => {
    if (canUseAdvisor) {
      userStorage.getItem('showNotice').then((showNotice) => {
        if (showNotice !== 'false') {
          setShowNotice(true);
        }
      });
    }
  }, [canUseAdvisor]);

  return showNotice ? (
    <Alert
      severity="info"
      title=""
      onRemove={() => {
        userStorage.setItem('showNotice', 'false');
        setShowNotice(false);
      }}
    >
      <div className={styles.alertContent}>
        <p className={styles.alertParagraph}>
          <Trans i18nKey="connections.advisor-redirect-notice.body">
            Try the new Advisor to uncover potential issues with your data sources and plugins.
          </Trans>
        </p>
        <LinkButton
          aria-label={t('connections.advisor-redirect-notice.aria-label-link-to-advisor', 'Link to Advisor')}
          icon="arrow-right"
          href="/a/grafana-advisor-app"
          fill="text"
        >
          <Trans i18nKey="connections.advisor-redirect-notice.go-to-advisor">Go to Advisor</Trans>
        </LinkButton>
      </div>
    </Alert>
  ) : (
    <></>
  );
}
