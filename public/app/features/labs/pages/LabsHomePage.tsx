import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Text, useStyles2 } from '@grafana/ui';
import { NavLandingPage } from 'app/core/components/NavLandingPage/NavLandingPage';

export function LabsHomePage() {
  const styles = useStyles2(getStyles);

  return (
    <NavLandingPage
      navId="labs"
      header={
        <div className={styles.header}>
          <Text element="h1" variant="h1">
            <Trans i18nKey="labs.home.title">Labs</Trans>
          </Text>
          <Text color="secondary">
            <Trans i18nKey="labs.home.description">
              Discover experimental and preview Grafana capabilities before they become generally available.
            </Trans>
          </Text>
          <Alert
            severity="info"
            title={t('labs.home.warning-title', 'Labs features are experimental')}
          >
            <Trans i18nKey="labs.home.warning">
              Features in Labs may be unstable, incomplete, or change without notice. Review each feature before enabling
              it in production.
            </Trans>
          </Alert>
        </div>
      }
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  header: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    maxWidth: theme.spacing(92),
  }),
});
