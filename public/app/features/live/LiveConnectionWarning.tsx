import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { Unsubscribable } from 'rxjs';

import { GrafanaTheme2 } from '@grafana/data';
import { config, getGrafanaLiveSrv } from '@grafana/runtime';
import { Alert, stylesFactory } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

export interface Props {}

export interface State {
  show?: boolean;
}

export class LiveConnectionWarning extends PureComponent<Props, State> {
  subscription?: Unsubscribable;
  styles = getStyle(config.theme2);
  state: State = {};

  componentDidMount() {
    // Only show the error in development mode
    if (process.env.NODE_ENV === 'development') {
      // Wait a second to listen for server errors
      setTimeout(this.initListener, 1500);
    }
  }

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
      if (!contextSrv.isSignedIn || !config.liveEnabled || contextSrv.user.orgRole === '') {
        return null; // do not show the warning for anonymous users or ones with no org (and /login page etc)
      }

      return (
        <div className={this.styles.foot}>
          <Alert severity={'warning'} className={this.styles.warn} title="connection to server is lost..." />
        </div>
      );
    }
    return null;
  }
}

const getStyle = stylesFactory((theme: GrafanaTheme2) => {
  return {
    foot: css`
      position: absolute;
      bottom: 0px;
      left: 0px;
      right: 0px;
      z-index: 10000;
      cursor: wait;
      margin: 16px;
    `,
    warn: css`
      border: 2px solid ${theme.colors.warning.main};
      max-width: 400px;
      margin: auto;
      height: 3em;
    `,
  };
});
