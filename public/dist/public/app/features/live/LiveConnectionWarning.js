import { __extends, __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { config, getGrafanaLiveSrv } from '@grafana/runtime';
import { Alert, stylesFactory } from '@grafana/ui';
import React, { PureComponent } from 'react';
import { contextSrv } from 'app/core/services/context_srv';
var LiveConnectionWarning = /** @class */ (function (_super) {
    __extends(LiveConnectionWarning, _super);
    function LiveConnectionWarning() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.styles = getStyle(config.theme2);
        _this.state = {};
        _this.initListener = function () {
            var live = getGrafanaLiveSrv();
            if (live) {
                _this.subscription = live.getConnectionState().subscribe({
                    next: function (v) {
                        _this.setState({ show: !v });
                    },
                });
            }
        };
        return _this;
    }
    LiveConnectionWarning.prototype.componentDidMount = function () {
        // Only show the error in development mode
        if (process.env.NODE_ENV === 'development') {
            // Wait a second to listen for server errors
            setTimeout(this.initListener, 1500);
        }
    };
    LiveConnectionWarning.prototype.componentWillUnmount = function () {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    };
    LiveConnectionWarning.prototype.render = function () {
        var show = this.state.show;
        if (show) {
            if (!contextSrv.isSignedIn || !config.liveEnabled || contextSrv.user.orgRole === '') {
                return null; // do not show the warning for anonymous users or ones with no org (and /login page etc)
            }
            return (React.createElement("div", { className: this.styles.foot },
                React.createElement(Alert, { severity: 'warning', className: this.styles.warn, title: "connection to server is lost..." })));
        }
        return null;
    };
    return LiveConnectionWarning;
}(PureComponent));
export { LiveConnectionWarning };
var getStyle = stylesFactory(function (theme) {
    return {
        foot: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      position: absolute;\n      bottom: 0px;\n      left: 0px;\n      right: 0px;\n      z-index: 10000;\n      cursor: wait;\n      margin: 16px;\n    "], ["\n      position: absolute;\n      bottom: 0px;\n      left: 0px;\n      right: 0px;\n      z-index: 10000;\n      cursor: wait;\n      margin: 16px;\n    "]))),
        warn: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      border: 2px solid ", ";\n      max-width: 400px;\n      margin: auto;\n      height: 3em;\n    "], ["\n      border: 2px solid ", ";\n      max-width: 400px;\n      margin: auto;\n      height: 3em;\n    "])), theme.colors.warning.main),
    };
});
var templateObject_1, templateObject_2;
//# sourceMappingURL=LiveConnectionWarning.js.map