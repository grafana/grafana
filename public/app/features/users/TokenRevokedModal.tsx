import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, InfoBox, Portal, useStyles2, useTheme2 } from '@grafana/ui';
import { getModalStyles } from '@grafana/ui/src/components/Modal/getModalStyles';

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
        <InfoBox title="You have been automatically signed out" severity="warning" className={styles.infobox}>
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
              <strong>To resume your session, sign in again.</strong>
              Contact your administrator or visit the license page to review your quota if you are repeatedly signed out
              automatically.
            </p>
          </div>
          <Button size="md" variant="primary" onClick={redirectToLogin}>
            Sign in
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
