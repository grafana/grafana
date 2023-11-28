import { __awaiter } from "tslib";
import React from 'react';
import { dateTime } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { config, locationService } from '@grafana/runtime';
import { SceneObjectBase, sceneGraph } from '@grafana/scenes';
import { Alert, ClipboardButton, Field, FieldSet, Icon, Input, Switch } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { createShortLink } from 'app/core/utils/shortLinks';
import { ThemePicker } from 'app/features/dashboard/components/ShareModal/ThemePicker';
import { trackDashboardSharingActionPerType } from 'app/features/dashboard/components/ShareModal/analytics';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';
import { getDashboardUrl } from '../utils/utils';
export class ShareLinkTab extends SceneObjectBase {
    constructor(state) {
        super(Object.assign(Object.assign({}, state), { useLockedTime: true, useShortUrl: false, selectedTheme: 'current', shareUrl: '', imageUrl: '' }));
        this.onToggleLockedTime = () => {
            this.setState({ useLockedTime: !this.state.useLockedTime });
            this.buildUrl();
        };
        this.onUrlShorten = () => {
            this.setState({ useShortUrl: !this.state.useShortUrl });
            this.buildUrl();
        };
        this.onThemeChange = (value) => {
            this.setState({ selectedTheme: value });
            this.buildUrl();
        };
        this.getShareUrl = () => {
            return this.state.shareUrl;
        };
        this.addActivationHandler(() => {
            this.buildUrl();
        });
    }
    buildUrl() {
        return __awaiter(this, void 0, void 0, function* () {
            const { panelRef, dashboardRef, useLockedTime: useAbsoluteTimeRange, useShortUrl, selectedTheme } = this.state;
            const dashboard = dashboardRef.resolve();
            const panel = panelRef === null || panelRef === void 0 ? void 0 : panelRef.resolve();
            const location = locationService.getLocation();
            const timeRange = sceneGraph.getTimeRange(panel !== null && panel !== void 0 ? panel : dashboard);
            const urlParamsUpdate = {};
            if (panel) {
                urlParamsUpdate.viewPanel = panel.state.key;
            }
            if (useAbsoluteTimeRange) {
                urlParamsUpdate.from = timeRange.state.value.from.toISOString();
                urlParamsUpdate.to = timeRange.state.value.to.toISOString();
            }
            if (selectedTheme !== 'current') {
                urlParamsUpdate.theme = selectedTheme;
            }
            let shareUrl = getDashboardUrl({
                uid: dashboard.state.uid,
                currentQueryParams: location.search,
                updateQuery: urlParamsUpdate,
                absolute: true,
            });
            if (useShortUrl) {
                shareUrl = yield createShortLink(shareUrl);
            }
            const imageUrl = getDashboardUrl({
                uid: dashboard.state.uid,
                currentQueryParams: location.search,
                updateQuery: urlParamsUpdate,
                absolute: true,
                soloRoute: true,
                render: true,
                timeZone: getRenderTimeZone(timeRange.getTimeZone()),
            });
            this.setState({ shareUrl, imageUrl });
        });
    }
    getTabLabel() {
        return t('share-modal.tab-title.link', 'Link');
    }
    onCopy() {
        trackDashboardSharingActionPerType('copy_link', shareDashboardType.link);
    }
}
ShareLinkTab.Component = ShareLinkTabRenderer;
function ShareLinkTabRenderer({ model }) {
    const state = model.useState();
    const { panelRef, dashboardRef } = state;
    const dashboard = dashboardRef.resolve();
    const panel = panelRef === null || panelRef === void 0 ? void 0 : panelRef.resolve();
    const timeRange = sceneGraph.getTimeRange(panel !== null && panel !== void 0 ? panel : dashboard);
    const isRelativeTime = timeRange.state.to === 'now' ? true : false;
    const { useLockedTime, useShortUrl, selectedTheme, shareUrl, imageUrl } = state;
    const selectors = e2eSelectors.pages.SharePanelModal;
    const isDashboardSaved = Boolean(dashboard.state.uid);
    const lockTimeRangeLabel = t('share-modal.link.time-range-label', `Lock time range`);
    const lockTimeRangeDescription = t('share-modal.link.time-range-description', `Transforms the current relative time range to an absolute time range`);
    const shortenURLTranslation = t('share-modal.link.shorten-url', `Shorten URL`);
    const linkURLTranslation = t('share-modal.link.link-url', `Link URL`);
    return (React.createElement(React.Fragment, null,
        React.createElement("p", { className: "share-modal-info-text" },
            React.createElement(Trans, { i18nKey: "share-modal.link.info-text" }, "Create a direct link to this dashboard or panel, customized with the options below.")),
        React.createElement(FieldSet, null,
            React.createElement(Field, { label: lockTimeRangeLabel, description: isRelativeTime ? lockTimeRangeDescription : '' },
                React.createElement(Switch, { id: "share-current-time-range", value: useLockedTime, onChange: model.onToggleLockedTime })),
            React.createElement(ThemePicker, { selectedTheme: selectedTheme, onChange: model.onThemeChange }),
            React.createElement(Field, { label: shortenURLTranslation },
                React.createElement(Switch, { id: "share-shorten-url", value: useShortUrl, onChange: model.onUrlShorten })),
            React.createElement(Field, { label: linkURLTranslation },
                React.createElement(Input, { id: "link-url-input", value: shareUrl, readOnly: true, addonAfter: React.createElement(ClipboardButton, { icon: "copy", variant: "primary", getText: model.getShareUrl, onClipboardCopy: model.onCopy },
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
            React.createElement(Trans, { i18nKey: "share-modal.link.render-instructions" },
                "To render a panel image, you must install the",
                React.createElement("a", { href: "https://grafana.com/grafana/plugins/grafana-image-renderer", target: "_blank", rel: "noopener noreferrer", className: "external-link" }, "Grafana image renderer plugin"),
                ". Please contact your Grafana administrator to install the plugin.")))));
}
function getRenderTimeZone(timeZone) {
    const utcOffset = 'UTC' + encodeURIComponent(dateTime().format('Z'));
    if (timeZone === 'utc') {
        return 'UTC';
    }
    if (timeZone === 'browser') {
        if (!window.Intl) {
            return utcOffset;
        }
        const dateFormat = window.Intl.DateTimeFormat();
        const options = dateFormat.resolvedOptions();
        if (!options.timeZone) {
            return utcOffset;
        }
        return options.timeZone;
    }
    return timeZone;
}
//# sourceMappingURL=ShareLinkTab.js.map