import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, InfoBox, Portal, useStyles2, useTheme2 } from '@grafana/ui';
import { getModalStyles } from '@grafana/ui/internal';
import { Trans, t } from 'app/core/internationalization';

interface Props {
  maxConcurrentSessions?: number;
}

export const TokenRevokedModal = (props: Props) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const modalStyles = getModalStyles(theme);

  const showMaxConcurrentSessions = Boolean(props.maxConcurrentSessions);

  const redirectToLogin = () => {
    window.location.reload();
  };

  return (
    <Portal>
      <div className={modalStyles.modal}>
        <InfoBox
          title={t(
            'users.token-revoked-modal.title-you-have-been-automatically-signed-out',
            'You have been automatically signed out'
          )}
          severity="warning"
          className={styles.infobox}
        >
          <div className={styles.text}>
            <p>
              Your session token was automatically revoked because you have reached
              <strong>
                {` the maximum number of ${
                  showMaxConcurrentSessions ? props.maxConcurrentSessions : ''
                } concurrent sessions `}
              </strong>
              for your account.
            </p>
            <p>
              <Trans i18nKey="users.token-revoked-modal.resume-message">
                <strong>To resume your session, sign in again.</strong>
                Contact your administrator or visit the license page to review your quota if you are repeatedly signed
                out automatically.
              </Trans>
            </p>
          </div>
          <Button size="md" variant="primary" onClick={redirectToLogin}>
            <Trans i18nKey="users.token-revoked-modal.sign-in">Sign in</Trans>
          </Button>
        </InfoBox>
      </div>
      <div className={cx(modalStyles.modalBackdrop, styles.backdrop)} />
    </Portal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  infobox: css({
    marginBottom: 0,
  }),
  text: css({
    margin: theme.spacing(1, 0, 2),
  }),
  backdrop: css({
    backgroundColor: theme.colors.background.canvas,
    opacity: 0.8,
  }),
});
