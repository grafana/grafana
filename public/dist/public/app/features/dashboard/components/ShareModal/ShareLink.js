import { __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Alert, ClipboardButton, Field, FieldSet, Icon, Input, RadioButtonGroup, Switch } from '@grafana/ui';
import { AppEvents } from '@grafana/data';
import { buildImageUrl, buildShareUrl } from './utils';
import { appEvents } from 'app/core/core';
import config from 'app/core/config';
var themeOptions = [
    { label: 'Current', value: 'current' },
    { label: 'Dark', value: 'dark' },
    { label: 'Light', value: 'light' },
];
var ShareLink = /** @class */ (function (_super) {
    __extends(ShareLink, _super);
    function ShareLink(props) {
        var _this = _super.call(this, props) || this;
        _this.buildUrl = function () { return __awaiter(_this, void 0, void 0, function () {
            var panel, _a, useCurrentTimeRange, useShortUrl, selectedTheme, shareUrl, imageUrl;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        panel = this.props.panel;
                        _a = this.state, useCurrentTimeRange = _a.useCurrentTimeRange, useShortUrl = _a.useShortUrl, selectedTheme = _a.selectedTheme;
                        return [4 /*yield*/, buildShareUrl(useCurrentTimeRange, selectedTheme, panel, useShortUrl)];
                    case 1:
                        shareUrl = _b.sent();
                        imageUrl = buildImageUrl(useCurrentTimeRange, selectedTheme, panel);
                        this.setState({ shareUrl: shareUrl, imageUrl: imageUrl });
                        return [2 /*return*/];
                }
            });
        }); };
        _this.onUseCurrentTimeRangeChange = function () {
            _this.setState({ useCurrentTimeRange: !_this.state.useCurrentTimeRange });
        };
        _this.onUrlShorten = function () {
            _this.setState({ useShortUrl: !_this.state.useShortUrl });
        };
        _this.onThemeChange = function (value) {
            _this.setState({ selectedTheme: value });
        };
        _this.onShareUrlCopy = function () {
            appEvents.emit(AppEvents.alertSuccess, ['Content copied to clipboard']);
        };
        _this.getShareUrl = function () {
            return _this.state.shareUrl;
        };
        _this.state = {
            useCurrentTimeRange: true,
            useShortUrl: false,
            selectedTheme: 'current',
            shareUrl: '',
            imageUrl: '',
        };
        return _this;
    }
    ShareLink.prototype.componentDidMount = function () {
        this.buildUrl();
    };
    ShareLink.prototype.componentDidUpdate = function (prevProps, prevState) {
        var _a = this.state, useCurrentTimeRange = _a.useCurrentTimeRange, useShortUrl = _a.useShortUrl, selectedTheme = _a.selectedTheme;
        if (prevState.useCurrentTimeRange !== useCurrentTimeRange ||
            prevState.selectedTheme !== selectedTheme ||
            prevState.useShortUrl !== useShortUrl) {
            this.buildUrl();
        }
    };
    ShareLink.prototype.render = function () {
        var panel = this.props.panel;
        var isRelativeTime = this.props.dashboard ? this.props.dashboard.time.to === 'now' : false;
        var _a = this.state, useCurrentTimeRange = _a.useCurrentTimeRange, useShortUrl = _a.useShortUrl, selectedTheme = _a.selectedTheme, shareUrl = _a.shareUrl, imageUrl = _a.imageUrl;
        var selectors = e2eSelectors.pages.SharePanelModal;
        return (React.createElement(React.Fragment, null,
            React.createElement("p", { className: "share-modal-info-text" }, "Create a direct link to this dashboard or panel, customized with the options below."),
            React.createElement(FieldSet, null,
                React.createElement(Field, { label: "Lock time range", description: isRelativeTime ? 'Transforms the current relative time range to an absolute time range' : '' },
                    React.createElement(Switch, { id: "share-current-time-range", value: useCurrentTimeRange, onChange: this.onUseCurrentTimeRangeChange })),
                React.createElement(Field, { label: "Theme" },
                    React.createElement(RadioButtonGroup, { options: themeOptions, value: selectedTheme, onChange: this.onThemeChange })),
                React.createElement(Field, { label: "Shorten URL" },
                    React.createElement(Switch, { id: "share-shorten-url", value: useShortUrl, onChange: this.onUrlShorten })),
                React.createElement(Field, { label: "Link URL" },
                    React.createElement(Input, { id: "link-url-input", value: shareUrl, readOnly: true, addonAfter: React.createElement(ClipboardButton, { variant: "primary", getText: this.getShareUrl, onClipboardCopy: this.onShareUrlCopy },
                            React.createElement(Icon, { name: "copy" }),
                            " Copy") }))),
            panel && config.rendererAvailable && (React.createElement("div", { className: "gf-form" },
                React.createElement("a", { href: imageUrl, target: "_blank", rel: "noreferrer", "aria-label": selectors.linkToRenderedImage },
                    React.createElement(Icon, { name: "camera" }),
                    " Direct link rendered image"))),
            panel && !config.rendererAvailable && (React.createElement(Alert, { severity: "info", title: "Image renderer plugin not installed", bottomSpacing: 0 },
                React.createElement(React.Fragment, null, "To render a panel image, you must install the "),
                React.createElement("a", { href: "https://grafana.com/grafana/plugins/grafana-image-renderer", target: "_blank", rel: "noopener noreferrer", className: "external-link" }, "Grafana image renderer plugin"),
                ". Please contact your Grafana administrator to install the plugin."))));
    };
    return ShareLink;
}(PureComponent));
export { ShareLink };
//# sourceMappingURL=ShareLink.js.map