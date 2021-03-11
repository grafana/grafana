import React from 'react';
import { Button, InfoBox, Portal, stylesFactory, useTheme } from '@grafana/ui';
import { getModalStyles } from '@grafana/ui/src/components/Modal/getModalStyles';
import { css, cx } from 'emotion';

const getStyles = stylesFactory(() => {
  return {
    infobox: css`
      margin-bottom: 0;
    `,
    text: css`
      margin: 8px 0 16px;
    `,
    backdrop: css`
      background-color: #0b0d10;
      opacity: 0.8;
    `,
  };
});

interface Props {
  maxConcurrentSessions?: number;
}

export const TokenRevokedModal = (props: Props) => {
  const theme = useTheme();

  const styles = getStyles();
  const modalStyles = getModalStyles(theme);

  const showMaxConcurrentSessions = props.maxConcurrentSessions && props.maxConcurrentSessions > 0;

  const redirectToLogin = () => {
    window.location.reload();
  };

  return (
    <Portal>
      <div className={modalStyles.modal}>
        <InfoBox title="You have been automatically logged out" severity="warning" className={styles.infobox}>
          <div className={styles.text}>
            <p>
              Your session token was automatically revoked because you have reached
              <strong>
                {' '}
                the maximum number of
                {showMaxConcurrentSessions && <span> {props.maxConcurrentSessions} </span>}
                concurrent sessions{' '}
              </strong>
              for your account.
            </p>
            <p>
              <strong>You can sign in again to resume your session. </strong>
              Contact your administrator or visit license page to review your quota if you are logged out repeatedly.
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
