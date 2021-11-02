import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { ClipboardButton, Field, Modal, RadioButtonGroup, Switch, TextArea } from '@grafana/ui';
import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/core';
import { buildIframeHtml } from './utils';
var themeOptions = [
    { label: 'Current', value: 'current' },
    { label: 'Dark', value: 'dark' },
    { label: 'Light', value: 'light' },
];
var ShareEmbed = /** @class */ (function (_super) {
    __extends(ShareEmbed, _super);
    function ShareEmbed(props) {
        var _this = _super.call(this, props) || this;
        _this.buildIframeHtml = function () {
            var panel = _this.props.panel;
            var _a = _this.state, useCurrentTimeRange = _a.useCurrentTimeRange, selectedTheme = _a.selectedTheme;
            var iframeHtml = buildIframeHtml(useCurrentTimeRange, selectedTheme, panel);
            _this.setState({ iframeHtml: iframeHtml });
        };
        _this.onIframeHtmlChange = function (event) {
            _this.setState({ iframeHtml: event.currentTarget.value });
        };
        _this.onUseCurrentTimeRangeChange = function () {
            _this.setState({
                useCurrentTimeRange: !_this.state.useCurrentTimeRange,
            }, _this.buildIframeHtml);
        };
        _this.onThemeChange = function (value) {
            _this.setState({ selectedTheme: value }, _this.buildIframeHtml);
        };
        _this.onIframeHtmlCopy = function () {
            appEvents.emit(AppEvents.alertSuccess, ['Content copied to clipboard']);
        };
        _this.getIframeHtml = function () {
            return _this.state.iframeHtml;
        };
        _this.state = {
            useCurrentTimeRange: true,
            selectedTheme: 'current',
            iframeHtml: '',
        };
        return _this;
    }
    ShareEmbed.prototype.componentDidMount = function () {
        this.buildIframeHtml();
    };
    ShareEmbed.prototype.render = function () {
        var _a = this.state, useCurrentTimeRange = _a.useCurrentTimeRange, selectedTheme = _a.selectedTheme, iframeHtml = _a.iframeHtml;
        var isRelativeTime = this.props.dashboard ? this.props.dashboard.time.to === 'now' : false;
        return (React.createElement(React.Fragment, null,
            React.createElement("p", { className: "share-modal-info-text" }, "Generate HTML for embedding an iframe with this panel."),
            React.createElement(Field, { label: "Current time range", description: isRelativeTime ? 'Transforms the current relative time range to an absolute time range' : '' },
                React.createElement(Switch, { id: "share-current-time-range", value: useCurrentTimeRange, onChange: this.onUseCurrentTimeRangeChange })),
            React.createElement(Field, { label: "Theme" },
                React.createElement(RadioButtonGroup, { options: themeOptions, value: selectedTheme, onChange: this.onThemeChange })),
            React.createElement(Field, { label: "Embed HTML", description: "The HTML code below can be pasted and included in another web page. Unless anonymous access is enabled,\n                the user viewing that page need to be signed into Grafana for the graph to load." },
                React.createElement(TextArea, { id: "share-panel-embed-embed-html-textarea", rows: 5, value: iframeHtml, onChange: this.onIframeHtmlChange })),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(ClipboardButton, { variant: "primary", getText: this.getIframeHtml, onClipboardCopy: this.onIframeHtmlCopy }, "Copy to clipboard"))));
    };
    return ShareEmbed;
}(PureComponent));
export { ShareEmbed };
//# sourceMappingURL=ShareEmbed.js.map