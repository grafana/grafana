import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { Branding } from '../../../../core/components/Branding/Branding';
import { getLoginStyles } from '../../../../core/components/Login/LoginLayout';

const selectors = e2eSelectors.pages.PublicDashboard.NotAvailable;

export const PublicDashboardNotAvailable = ({ paused }: { paused?: boolean }) => {
  const styles = useStyles2(getStyles);
  const loginStyles = useStyles2(getLoginStyles);
  const loginBoxBackground = Branding.LoginBoxBackground();

  return (
    <Branding.LoginBackground className={styles.container} data-testid={selectors.container}>
      <div className={cx(styles.box, loginBoxBackground)}>
        <Branding.LoginLogo className={loginStyles.loginLogo} />
        <p className={styles.title} data-testid={selectors.title}>
          {paused
            ? t(
                'dashboard.public-dashboard-not-available.paused',
                'This dashboard has been paused by the administrator'
              )
            : t(
                'dashboard.public-dashboard-not-available.does-not-exist',
                'The dashboard you are trying to access does not exist'
              )}
        </p>
        {paused && (
          <p className={styles.description} data-testid={selectors.pausedDescription}>
            <Trans i18nKey="dashboard.public-dashboard-not-available.try-again-later">Try again later</Trans>
          </p>
        )}
      </div>
    </Branding.LoginBackground>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',

    ':before': {
      opacity: 1,
    },
  }),
  box: css({
    width: '608px',
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'column',
    gap: theme.spacing(4),
    zIndex: 1,
    borderRadius: theme.shape.borderRadius(4),
    padding: theme.spacing(6, 8),
    opacity: 1,
  }),
  title: css({
    fontSize: theme.typography.h3.fontSize,
    textAlign: 'center',
    margin: 0,
  }),
  description: css({
    fontSize: theme.typography.h5.fontSize,
    margin: 0,
  }),
});
