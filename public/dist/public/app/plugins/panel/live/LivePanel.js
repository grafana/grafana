import { __assign, __awaiter, __extends, __generator, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { Alert, stylesFactory, Button, JSONFormatter, CustomScrollbar, CodeEditor } from '@grafana/ui';
import { isValidLiveChannelAddress, isLiveChannelStatusEvent, isLiveChannelMessageEvent, LiveChannelConnectionState, LoadingState, applyFieldOverrides, StreamingDataFrame, } from '@grafana/data';
import { TablePanel } from '../table/TablePanel';
import { MessageDisplayMode } from './types';
import { config, getGrafanaLiveSrv } from '@grafana/runtime';
import { css, cx } from '@emotion/css';
import { isEqual } from 'lodash';
var LivePanel = /** @class */ (function (_super) {
    __extends(LivePanel, _super);
    function LivePanel(props) {
        var _this = _super.call(this, props) || this;
        _this.styles = getStyles(config.theme);
        _this.streamObserver = {
            next: function (event) {
                if (isLiveChannelStatusEvent(event)) {
                    _this.setState({ status: event, changed: Date.now() });
                }
                else if (isLiveChannelMessageEvent(event)) {
                    _this.setState({ message: event.message, changed: Date.now() });
                }
                else {
                    console.log('ignore', event);
                }
            },
        };
        _this.unsubscribe = function () {
            if (_this.subscription) {
                _this.subscription.unsubscribe();
                _this.subscription = undefined;
            }
        };
        _this.onSaveJSON = function (text) {
            var _a = _this.props, options = _a.options, onOptionsChange = _a.onOptionsChange;
            try {
                var json = JSON.parse(text);
                onOptionsChange(__assign(__assign({}, options), { json: json }));
            }
            catch (err) {
                console.log('Error reading JSON', err);
            }
        };
        _this.onPublishClicked = function () { return __awaiter(_this, void 0, void 0, function () {
            var addr, data, rsp;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        addr = this.state.addr;
                        if (!addr) {
                            console.log('invalid address');
                            return [2 /*return*/];
                        }
                        data = (_a = this.props.options) === null || _a === void 0 ? void 0 : _a.json;
                        if (!data) {
                            console.log('nothing to publish');
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, getGrafanaLiveSrv().publish(addr, data)];
                    case 1:
                        rsp = _b.sent();
                        console.log('onPublishClicked (response from publish)', rsp);
                        return [2 /*return*/];
                }
            });
        }); };
        _this.isValid = !!getGrafanaLiveSrv();
        _this.state = { changed: 0 };
        return _this;
    }
    LivePanel.prototype.componentDidMount = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.loadChannel();
                return [2 /*return*/];
            });
        });
    };
    LivePanel.prototype.componentWillUnmount = function () {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    };
    LivePanel.prototype.componentDidUpdate = function (prevProps) {
        var _a, _b;
        if (((_a = this.props.options) === null || _a === void 0 ? void 0 : _a.channel) !== ((_b = prevProps.options) === null || _b === void 0 ? void 0 : _b.channel)) {
            this.loadChannel();
        }
    };
    LivePanel.prototype.loadChannel = function () {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var addr, live;
            return __generator(this, function (_b) {
                addr = (_a = this.props.options) === null || _a === void 0 ? void 0 : _a.channel;
                if (!isValidLiveChannelAddress(addr)) {
                    console.log('INVALID', addr);
                    this.unsubscribe();
                    this.setState({
                        addr: undefined,
                    });
                    return [2 /*return*/];
                }
                if (isEqual(addr, this.state.addr)) {
                    console.log('Same channel', this.state.addr);
                    return [2 /*return*/];
                }
                live = getGrafanaLiveSrv();
                if (!live) {
                    console.log('INVALID', addr);
                    this.unsubscribe();
                    this.setState({
                        addr: undefined,
                    });
                    return [2 /*return*/];
                }
                this.unsubscribe();
                console.log('LOAD', addr);
                // Subscribe to new events
                try {
                    this.subscription = live.getStream(addr).subscribe(this.streamObserver);
                    this.setState({ addr: addr, error: undefined });
                }
                catch (err) {
                    this.setState({ addr: undefined, error: err });
                }
                return [2 /*return*/];
            });
        });
    };
    LivePanel.prototype.renderNotEnabled = function () {
        var preformatted = "[feature_toggles]\n    enable = live";
        return (React.createElement(Alert, { title: "Grafana Live", severity: "info" },
            React.createElement("p", null, "Grafana live requires a feature flag to run"),
            React.createElement("b", null, "custom.ini:"),
            React.createElement("pre", null, preformatted)));
    };
    LivePanel.prototype.renderMessage = function (height) {
        var _a, _b, _c;
        var options = this.props.options;
        var message = this.state.message;
        if (!message) {
            return (React.createElement("div", null,
                React.createElement("h4", null, "Waiting for data:"), (_a = options.channel) === null || _a === void 0 ? void 0 :
                _a.scope,
                "/", (_b = options.channel) === null || _b === void 0 ? void 0 :
                _b.namespace,
                "/", (_c = options.channel) === null || _c === void 0 ? void 0 :
                _c.path));
        }
        if (options.message === MessageDisplayMode.JSON) {
            return React.createElement(JSONFormatter, { json: message, open: 5 });
        }
        if (options.message === MessageDisplayMode.Auto) {
            if (message instanceof StreamingDataFrame) {
                var data = {
                    series: applyFieldOverrides({
                        data: [message],
                        theme: config.theme2,
                        replaceVariables: function (v) { return v; },
                        fieldConfig: {
                            defaults: {},
                            overrides: [],
                        },
                    }),
                    state: LoadingState.Streaming,
                };
                var props = __assign(__assign({}, this.props), { options: { frameIndex: 0, showHeader: true } });
                return React.createElement(TablePanel, __assign({}, props, { data: data, height: height }));
            }
        }
        return React.createElement("pre", null, JSON.stringify(message));
    };
    LivePanel.prototype.renderPublish = function (height) {
        var options = this.props.options;
        return (React.createElement(React.Fragment, null,
            React.createElement(CodeEditor, { height: height - 32, language: "json", value: options.json ? JSON.stringify(options.json, null, 2) : '{ }', onBlur: this.onSaveJSON, onSave: this.onSaveJSON, showMiniMap: false, showLineNumbers: true }),
            React.createElement("div", { style: { height: 32 } },
                React.createElement(Button, { onClick: this.onPublishClicked }, "Publish"))));
    };
    LivePanel.prototype.renderStatus = function () {
        var status = this.state.status;
        if ((status === null || status === void 0 ? void 0 : status.state) === LiveChannelConnectionState.Connected) {
            return; // nothing
        }
        var statusClass = '';
        if (status) {
            statusClass = this.styles.status[status.state];
        }
        return React.createElement("div", { className: cx(statusClass, this.styles.statusWrap) }, status === null || status === void 0 ? void 0 : status.state);
    };
    LivePanel.prototype.renderBody = function () {
        var status = this.state.status;
        var _a = this.props, options = _a.options, height = _a.height;
        if (options.publish) {
            // Only the publish form
            if (options.message === MessageDisplayMode.None) {
                return React.createElement("div", null, this.renderPublish(height));
            }
            // Both message and publish
            var halfHeight = height / 2;
            return (React.createElement("div", null,
                React.createElement("div", { style: { height: halfHeight, overflow: 'hidden' } },
                    React.createElement(CustomScrollbar, { autoHeightMin: "100%", autoHeightMax: "100%" }, this.renderMessage(halfHeight))),
                React.createElement("div", null, this.renderPublish(halfHeight))));
        }
        if (options.message === MessageDisplayMode.None) {
            return React.createElement("pre", null, JSON.stringify(status));
        }
        // Only message
        return (React.createElement("div", { style: { overflow: 'hidden', height: height } },
            React.createElement(CustomScrollbar, { autoHeightMin: "100%", autoHeightMax: "100%" }, this.renderMessage(height))));
    };
    LivePanel.prototype.render = function () {
        if (!this.isValid) {
            return this.renderNotEnabled();
        }
        var _a = this.state, addr = _a.addr, error = _a.error;
        if (!addr) {
            return (React.createElement(Alert, { title: "Grafana Live", severity: "info" }, "Use the panel editor to pick a channel"));
        }
        if (error) {
            return (React.createElement("div", null,
                React.createElement("h2", null, "ERROR"),
                React.createElement("div", null, JSON.stringify(error))));
        }
        return (React.createElement(React.Fragment, null,
            this.renderStatus(),
            this.renderBody()));
    };
    return LivePanel;
}(PureComponent));
export { LivePanel };
var getStyles = stylesFactory(function (theme) {
    var _a;
    return ({
        statusWrap: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin: auto;\n    position: absolute;\n    top: 0;\n    right: 0;\n    background: ", ";\n    padding: 10px;\n    z-index: ", ";\n  "], ["\n    margin: auto;\n    position: absolute;\n    top: 0;\n    right: 0;\n    background: ", ";\n    padding: 10px;\n    z-index: ", ";\n  "])), theme.colors.panelBg, theme.zIndex.modal),
        status: (_a = {},
            _a[LiveChannelConnectionState.Pending] = css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      border: 1px solid ", ";\n    "], ["\n      border: 1px solid ", ";\n    "])), theme.palette.brandPrimary),
            _a[LiveChannelConnectionState.Connected] = css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      border: 1px solid ", ";\n    "], ["\n      border: 1px solid ", ";\n    "])), theme.palette.brandSuccess),
            _a[LiveChannelConnectionState.Disconnected] = css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      border: 1px solid ", ";\n    "], ["\n      border: 1px solid ", ";\n    "])), theme.palette.brandWarning),
            _a[LiveChannelConnectionState.Shutdown] = css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      border: 1px solid ", ";\n    "], ["\n      border: 1px solid ", ";\n    "])), theme.palette.brandDanger),
            _a[LiveChannelConnectionState.Invalid] = css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      border: 1px solid red;\n    "], ["\n      border: 1px solid red;\n    "]))),
            _a),
    });
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
//# sourceMappingURL=LivePanel.js.map