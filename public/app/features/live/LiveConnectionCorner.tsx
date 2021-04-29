import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { config, getGrafanaLiveSrv } from '@grafana/runtime';
import { stylesFactory } from '@grafana/ui';
import React, { PureComponent } from 'react';
import { Unsubscribable } from 'rxjs';

export interface Props {}

export interface State {
  show?: boolean;
}

export class LiveConnectionCorner extends PureComponent<Props, State> {
  subscription?: Unsubscribable;
  styles = getStyle(config.theme);
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
      return <div className={this.styles.corner} title="The server is disconnected" />;
    }
    return null;
  }
}

const getStyle = stylesFactory((theme: GrafanaTheme) => {
  return {
    corner: css`
      position: fixed;
      top: 0px !important;
      left: 0px !important;
      width: 0;
      height: 0;
      border-top: 60px solid ${theme.palette.brandWarning};
      border-right: 60px solid transparent;
      z-index: 10000;
      cursor: wait;
    `,
  };
});
