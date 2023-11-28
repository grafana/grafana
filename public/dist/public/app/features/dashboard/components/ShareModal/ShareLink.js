import { __awaiter } from "tslib";
import React, { PureComponent } from 'react';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Alert, ClipboardButton, Field, FieldSet, Icon, Input, Switch } from '@grafana/ui';
import config from 'app/core/config';
import { t, Trans } from 'app/core/internationalization';
import { ThemePicker } from './ThemePicker';
import { trackDashboardSharingActionPerType } from './analytics';
import { buildImageUrl, buildShareUrl, shareDashboardType } from './utils';
export class ShareLink extends PureComponent {
    constructor(props) {
        super(props);
        this.buildUrl = () => __awaiter(this, void 0, void 0, function* () {
            const { panel, dashboard } = this.props;
            const { useCurrentTimeRange, useShortUrl, selectedTheme } = this.state;
            const shareUrl = yield buildShareUrl(useCurrentTimeRange, selectedTheme, panel, useShortUrl);
            const imageUrl = buildImageUrl(useCurrentTimeRange, dashboard.uid, selectedTheme, panel);
            this.setState({ shareUrl, imageUrl });
        });
        this.onUseCurrentTimeRangeChange = () => {
            this.setState({ useCurrentTimeRange: !this.state.useCurrentTimeRange });
        };
        this.onUrlShorten = () => {
            this.setState({ useShortUrl: !this.state.useShortUrl });
        };
        this.onThemeChange = (value) => {
            this.setState({ selectedTheme: value });
        };
        this.getShareUrl = () => {
            return this.state.shareUrl;
        };
        this.state = {
            useCurrentTimeRange: true,
            useShortUrl: false,
            selectedTheme: 'current',
            shareUrl: '',
            imageUrl: '',
        };
    }
    componentDidMount() {
        this.buildUrl();
    }
    componentDidUpdate(prevProps, prevState) {
        const { useCurrentTimeRange, useShortUrl, selectedTheme } = this.state;
        if (prevState.useCurrentTimeRange !== useCurrentTimeRange ||
            prevState.selectedTheme !== selectedTheme ||
            prevState.useShortUrl !== useShortUrl) {
            this.buildUrl();
        }
    }
    onCopy() {
        trackDashboardSharingActionPerType('copy_link', shareDashboardType.link);
    }
    render() {
        const { panel, dashboard } = this.props;
        const isRelativeTime = dashboard ? dashboard.time.to === 'now' : false;
        const { useCurrentTimeRange, useShortUrl, selectedTheme, shareUrl, imageUrl } = this.state;
        const selectors = e2eSelectors.pages.SharePanelModal;
        const isDashboardSaved = Boolean(dashboard.id);
        const isPMM = !!(config.bootData.navTree || []).find((item) => item.id === 'pmm');
        const differentLocalhostDomains = isPMM && config.appUrl.includes('localhost') && !window.location.host.includes('localhost');
        const timeRangeLabelTranslation = t('share-modal.link.time-range-label', `Lock time range`);
        const timeRangeDescriptionTranslation = t('share-modal.link.time-range-description', `Transforms the current relative time range to an absolute time range`);
        const shortenURLTranslation = t('share-modal.link.shorten-url', `Shorten URL`);
        const linkURLTranslation = t('share-modal.link.link-url', `Link URL`);
        return (React.createElement(React.Fragment, null,
            React.createElement("p", { className: "share-modal-info-text" },
                React.createElement(Trans, { i18nKey: "share-modal.link.info-text" }, "Create a direct link to this dashboard or panel, customized with the options below.")),
            React.createElement(FieldSet, null,
                React.createElement(Field, { label: timeRangeLabelTranslation, description: isRelativeTime ? timeRangeDescriptionTranslation : '' },
                    React.createElement(Switch, { id: "share-current-time-range", value: useCurrentTimeRange, onChange: this.onUseCurrentTimeRangeChange })),
                React.createElement(ThemePicker, { selectedTheme: selectedTheme, onChange: this.onThemeChange }),
                differentLocalhostDomains && (React.createElement(Alert, { title: "PMM: URL mismatch", severity: "warning" },
                    React.createElement("p", null, "Your domain on Grafana's .ini file is localhost but you are on a different domain. The short URL will point to localhost, which might be wrong."),
                    React.createElement("p", null, "Please change your .ini and restart Grafana if you want the URL shortener to function correctly, or just use the full URL."))),
                React.createElement(Field, { label: shortenURLTranslation },
                    React.createElement(Switch, { id: "share-shorten-url", value: useShortUrl, onChange: this.onUrlShorten })),
                React.createElement(Field, { label: linkURLTranslation },
                    React.createElement(Input, { id: "link-url-input", value: shareUrl, readOnly: true, addonAfter: React.createElement(ClipboardButton, { icon: "copy", variant: "primary", getText: this.getShareUrl, onClipboardCopy: this.onCopy },
                            React.createElement(Trans, { i18nKey: "share-modal.link.copy-link-button" }, "Copy")) }))),
            panel && config.rendererAvailable && (React.createElement(React.Fragment, null,
                isDashboardSaved && (React.createElement("div", { className: "gf-form" },
                    React.createElement("a", { href: imageUrl, target: "_blank", rel: "noreferrer", "aria-label": selectors.linkToRenderedImage },
                        React.createElement(Icon, { name: "camera" }),
                        "\u00A0",
                        React.createElement(Trans, { i18nKey: "share-modal.link.rendered-image" }, "Direct link rendered image")))),
                !isDashboardSaved && (React.createElement(Alert, { severity: "info", title: t('share-modal.link.save-alert', 'Dashboard is not saved'), bottomSpacing: 0 },
                    React.createElement(Trans, { i18nKey: "share-modal.link.save-dashboard" }, "To render a panel image, you must save the dashboard first."))))),
            panel && !config.rendererAvailable && (React.createElement(Alert, { severity: "info", title: t('share-modal.link.render-alert', 'Image renderer plugin not installed'), bottomSpacing: 0 },
                React.createElement(Trans, { id: "share-modal.link.render-instructions" },
                    "To render a panel image, you must install the\u00A0",
                    React.createElement("a", { href: "https://per.co.na/share_png", target: "_blank", rel: "noopener noreferrer", className: "external-link" }, "Image Renderer plugin"),
                    ". Please contact your PMM administrator to install the plugin.")))));
    }
}
//# sourceMappingURL=ShareLink.js.map