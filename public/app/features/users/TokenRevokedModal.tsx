import React from 'react';
import { Button, InfoBox, Portal, stylesFactory, useTheme } from '@grafana/ui';
import { getModalStyles } from '@grafana/ui/src/components/Modal/getModalStyles';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

interface Props {
  maxConcurrentSessions?: number;
}

export const TokenRevokedModal = (props: Props) => {
  const theme = useTheme();

  const styles = getStyles(theme);
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

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    infobox: css`
      margin-bottom: 0;
    `,
    text: css`
      margin: ${theme.spacing.sm} 0 ${theme.spacing.md};
    `,
    backdrop: css`
      background-color: ${theme.colors.dashboardBg};
      opacity: 0.8;
    `,
  };
});
