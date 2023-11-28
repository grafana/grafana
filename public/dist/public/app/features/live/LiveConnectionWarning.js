import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { config, getGrafanaLiveSrv } from '@grafana/runtime';
import { Alert, stylesFactory } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
export class LiveConnectionWarning extends PureComponent {
    constructor() {
        super(...arguments);
        this.styles = getStyle(config.theme2);
        this.state = {};
        this.initListener = () => {
            const live = getGrafanaLiveSrv();
            if (live) {
                this.subscription = live.getConnectionState().subscribe({
                    next: (v) => {
                        this.setState({ show: !v });
                    },
                });
            }
        };
    }
    componentDidMount() {
        // Only show the error in development mode
        if (process.env.NODE_ENV === 'development') {
            // Wait a second to listen for server errors
            setTimeout(this.initListener, 1500);
        }
    }
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
            return (React.createElement("div", { className: this.styles.foot },
                React.createElement(Alert, { severity: 'warning', className: this.styles.warn, title: "connection to server is lost..." })));
        }
        return null;
    }
}
const getStyle = stylesFactory((theme) => {
    return {
        foot: css `
      position: absolute;
      bottom: 0px;
      left: 0px;
      right: 0px;
      z-index: 10000;
      cursor: wait;
      margin: 16px;
    `,
        warn: css `
      max-width: 400px;
      margin: auto;
    `,
    };
});
//# sourceMappingURL=LiveConnectionWarning.js.map