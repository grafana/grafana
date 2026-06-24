import { css } from '@emotion/css';
import { memo, useEffect, useRef, useState } from 'react';
import { type Unsubscribable } from 'rxjs';

import { type GrafanaTheme2, OrgRole } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getGrafanaLiveSrv } from '@grafana/runtime';
import { Alert, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

export const LiveConnectionWarning = memo(function LiveConnectionWarning() {
  const [show, setShow] = useState<boolean | undefined>(undefined);
  const subscriptionRef = useRef<Unsubscribable | undefined>(undefined);
  const styles = useStyles2(getStyle);

  useEffect(() => {
    // Only show the error in development mode
    if (process.env.NODE_ENV === 'development') {
      // Wait a second to listen for server errors
      const timer = setTimeout(() => {
        const live = getGrafanaLiveSrv();
        if (live) {
          subscriptionRef.current = live.getConnectionState().subscribe({
            next: (v) => {
              setShow(!v);
            },
          });
        }
      }, 1500);

      return () => {
        clearTimeout(timer);
        if (subscriptionRef.current) {
          subscriptionRef.current.unsubscribe();
        }
      };
    }

    return undefined;
  }, []);

  if (show) {
    if (!contextSrv.isSignedIn || !config.liveEnabled || contextSrv.user.orgRole === OrgRole.None) {
      return null; // do not show the warning for anonymous users or ones with no org (and /login page etc)
    }

    return (
      <Alert
        severity={'warning'}
        className={styles.warn}
        title={t('live.live-connection-warning.title-connection-to-server-is-lost', 'Connection to server is lost...')}
      />
    );
  }
<<<<<<< HEAD

  initListener = () => {
    const live = getGrafanaLiveSrv();
    if (live) {
      this.subscription = live.getConnectionState().subscribe({
        next: (v) => {
          this.setState({ show: !v });
        },
      });
    }
  };

  componentWillUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  render() {
    const { show } = this.state;
    if (show) {
      if (!contextSrv.isSignedIn || !config.liveEnabled || contextSrv.user.orgRole === OrgRole.None) {
        return null; // do not show the warning for anonymous users or ones with no org (and /login page etc)
      }

      return (
        <div className={this.styles.foot}>
          <Alert severity={'warning'} className={this.styles.warn} title="cоединение с сервером потеряно..." />
        </div>
      );
    }
    return null;
  }
}

const getStyle = stylesFactory((theme: GrafanaTheme2) => {
  return {
    foot: css({
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 10000,
      cursor: 'wait',
      margin: theme.spacing(2),
    }),
    warn: css({
      maxWidth: '400px',
      margin: 'auto',
    }),
  };
=======
  return null;
});

const getStyle = (theme: GrafanaTheme2) => ({
  warn: css({
    position: 'fixed',
    bottom: 0,
    left: '50%',
    transform: 'translate(-50%)',
    maxWidth: '400px',
    zIndex: theme.zIndex.portal,
    cursor: 'wait',
  }),
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
});
