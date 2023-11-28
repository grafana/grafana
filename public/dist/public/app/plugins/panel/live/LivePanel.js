import { __awaiter } from "tslib";
import { css, cx } from '@emotion/css';
import { isEqual } from 'lodash';
import React, { PureComponent } from 'react';
import { isValidLiveChannelAddress, isLiveChannelStatusEvent, isLiveChannelMessageEvent, LiveChannelConnectionState, LoadingState, applyFieldOverrides, StreamingDataFrame, } from '@grafana/data';
import { config, getGrafanaLiveSrv } from '@grafana/runtime';
import { Alert, stylesFactory, Button, JSONFormatter, CustomScrollbar, CodeEditor } from '@grafana/ui';
import { TablePanel } from '../table/TablePanel';
import { MessageDisplayMode } from './types';
export class LivePanel extends PureComponent {
    constructor(props) {
        super(props);
        this.styles = getStyles(config.theme2);
        this.streamObserver = {
            next: (event) => {
                if (isLiveChannelStatusEvent(event)) {
                    this.setState({ status: event, changed: Date.now() });
                }
                else if (isLiveChannelMessageEvent(event)) {
                    this.setState({ message: event.message, changed: Date.now() });
                }
                else {
                    console.log('ignore', event);
                }
            },
        };
        this.unsubscribe = () => {
            if (this.subscription) {
                this.subscription.unsubscribe();
                this.subscription = undefined;
            }
        };
        this.onSaveJSON = (text) => {
            const { options, onOptionsChange } = this.props;
            try {
                const json = JSON.parse(text);
                onOptionsChange(Object.assign(Object.assign({}, options), { json }));
            }
            catch (err) {
                console.log('Error reading JSON', err);
            }
        };
        this.onPublishClicked = () => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { addr } = this.state;
            if (!addr) {
                console.log('invalid address');
                return;
            }
            const data = (_a = this.props.options) === null || _a === void 0 ? void 0 : _a.json;
            if (!data) {
                console.log('nothing to publish');
                return;
            }
            const rsp = yield getGrafanaLiveSrv().publish(addr, data);
            console.log('onPublishClicked (response from publish)', rsp);
        });
        this.isValid = !!getGrafanaLiveSrv();
        this.state = { changed: 0 };
    }
    componentDidMount() {
        return __awaiter(this, void 0, void 0, function* () {
            this.loadChannel();
        });
    }
    componentWillUnmount() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }
    componentDidUpdate(prevProps) {
        var _a, _b;
        if (((_a = this.props.options) === null || _a === void 0 ? void 0 : _a.channel) !== ((_b = prevProps.options) === null || _b === void 0 ? void 0 : _b.channel)) {
            this.loadChannel();
        }
    }
    loadChannel() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const addr = (_a = this.props.options) === null || _a === void 0 ? void 0 : _a.channel;
            if (!isValidLiveChannelAddress(addr)) {
                console.log('INVALID', addr);
                this.unsubscribe();
                this.setState({
                    addr: undefined,
                });
                return;
            }
            if (isEqual(addr, this.state.addr)) {
                console.log('Same channel', this.state.addr);
                return;
            }
            const live = getGrafanaLiveSrv();
            if (!live) {
                console.log('INVALID', addr);
                this.unsubscribe();
                this.setState({
                    addr: undefined,
                });
                return;
            }
            this.unsubscribe();
            console.log('LOAD', addr);
            // Subscribe to new events
            try {
                this.subscription = live.getStream(addr).subscribe(this.streamObserver);
                this.setState({ addr, error: undefined });
            }
            catch (err) {
                this.setState({ addr: undefined, error: err });
            }
        });
    }
    renderNotEnabled() {
        const preformatted = `[feature_toggles]
    enable = live`;
        return (React.createElement(Alert, { title: "Grafana Live", severity: "info" },
            React.createElement("p", null, "Grafana live requires a feature flag to run"),
            React.createElement("b", null, "custom.ini:"),
            React.createElement("pre", null, preformatted)));
    }
    renderMessage(height) {
        var _a, _b, _c;
        const { options } = this.props;
        const { message } = this.state;
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
                const data = {
                    series: applyFieldOverrides({
                        data: [message],
                        theme: config.theme2,
                        replaceVariables: (v) => v,
                        fieldConfig: {
                            defaults: {},
                            overrides: [],
                        },
                    }),
                    state: LoadingState.Streaming,
                };
                const props = Object.assign(Object.assign({}, this.props), { options: { frameIndex: 0, showHeader: true } });
                return React.createElement(TablePanel, Object.assign({}, props, { data: data, height: height }));
            }
        }
        return React.createElement("pre", null, JSON.stringify(message));
    }
    renderPublish(height) {
        const { options } = this.props;
        return (React.createElement(React.Fragment, null,
            React.createElement(CodeEditor, { height: height - 32, language: "json", value: options.json ? JSON.stringify(options.json, null, 2) : '{ }', onBlur: this.onSaveJSON, onSave: this.onSaveJSON, showMiniMap: false, showLineNumbers: true }),
            React.createElement("div", { style: { height: 32 } },
                React.createElement(Button, { onClick: this.onPublishClicked }, "Publish"))));
    }
    renderStatus() {
        const { status } = this.state;
        if ((status === null || status === void 0 ? void 0 : status.state) === LiveChannelConnectionState.Connected) {
            return; // nothing
        }
        let statusClass = '';
        if (status) {
            statusClass = this.styles.status[status.state];
        }
        return React.createElement("div", { className: cx(statusClass, this.styles.statusWrap) }, status === null || status === void 0 ? void 0 : status.state);
    }
    renderBody() {
        const { status } = this.state;
        const { options, height } = this.props;
        if (options.publish) {
            // Only the publish form
            if (options.message === MessageDisplayMode.None) {
                return React.createElement("div", null, this.renderPublish(height));
            }
            // Both message and publish
            const halfHeight = height / 2;
            return (React.createElement("div", null,
                React.createElement("div", { style: { height: halfHeight, overflow: 'hidden' } },
                    React.createElement(CustomScrollbar, { autoHeightMin: "100%", autoHeightMax: "100%" }, this.renderMessage(halfHeight))),
                React.createElement("div", null, this.renderPublish(halfHeight))));
        }
        if (options.message === MessageDisplayMode.None) {
            return React.createElement("pre", null, JSON.stringify(status));
        }
        // Only message
        return (React.createElement("div", { style: { overflow: 'hidden', height } },
            React.createElement(CustomScrollbar, { autoHeightMin: "100%", autoHeightMax: "100%" }, this.renderMessage(height))));
    }
    render() {
        if (!this.isValid) {
            return this.renderNotEnabled();
        }
        const { addr, error } = this.state;
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
    }
}
const getStyles = stylesFactory((theme) => ({
    statusWrap: css `
    margin: auto;
    position: absolute;
    top: 0;
    right: 0;
    background: ${theme.components.panel.background};
    padding: 10px;
    z-index: ${theme.zIndex.modal};
  `,
    status: {
        [LiveChannelConnectionState.Pending]: css `
      border: 1px solid ${theme.v1.palette.orange};
    `,
        [LiveChannelConnectionState.Connected]: css `
      border: 1px solid ${theme.colors.success.main};
    `,
        [LiveChannelConnectionState.Connecting]: css `
      border: 1px solid ${theme.v1.palette.brandWarning};
    `,
        [LiveChannelConnectionState.Disconnected]: css `
      border: 1px solid ${theme.colors.warning.main};
    `,
        [LiveChannelConnectionState.Shutdown]: css `
      border: 1px solid ${theme.colors.error.main};
    `,
        [LiveChannelConnectionState.Invalid]: css `
      border: 1px solid red;
    `,
    },
}));
//# sourceMappingURL=LivePanel.js.map