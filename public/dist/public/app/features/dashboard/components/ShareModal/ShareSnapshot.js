import { __awaiter } from "tslib";
import React, { PureComponent } from 'react';
import { isEmptyObject } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Button, ClipboardButton, Field, Input, LinkButton, Modal, Select, Spinner } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { VariableRefresh } from '../../../variables/types';
import { trackDashboardSharingActionPerType } from './analytics';
import { shareDashboardType } from './utils';
const snapshotApiUrl = '/api/snapshots';
export class ShareSnapshot extends PureComponent {
    constructor(props) {
        super(props);
        this.createSnapshot = (external) => () => {
            const { timeoutSeconds } = this.state;
            this.dashboard.snapshot = {
                timestamp: new Date(),
            };
            // @PERCONA
            // @PERCONA_TODO
            // TODO: check window.forceRefresh
            if (!external) {
                this.dashboard.snapshot.originalUrl = window.location.href;
            }
            // @ts-ignore
            window.forceRefresh = true;
            this.setState({ isLoading: true });
            this.dashboard.startRefresh();
            setTimeout(() => {
                this.saveSnapshot(this.dashboard, external);
                // @ts-ignore
                window.forceRefresh = false;
            }, timeoutSeconds * 1000);
        };
        this.saveSnapshot = (dashboard, external) => __awaiter(this, void 0, void 0, function* () {
            const { snapshotExpires } = this.state;
            const dash = this.dashboard.getSaveModelCloneOld();
            this.scrubDashboard(dash);
            const cmdData = {
                dashboard: dash,
                name: dash.title,
                expires: snapshotExpires,
                external: external,
            };
            try {
                const results = yield getBackendSrv().post(snapshotApiUrl, cmdData);
                this.setState({
                    deleteUrl: results.deleteUrl,
                    snapshotUrl: results.url,
                    step: 2,
                });
            }
            finally {
                trackDashboardSharingActionPerType(external ? 'publish_snapshot' : 'local_snapshot', shareDashboardType.snapshot);
                this.setState({ isLoading: false });
            }
        });
        this.scrubDashboard = (dash) => {
            const { panel } = this.props;
            const { snapshotName } = this.state;
            // change title
            dash.title = snapshotName;
            // make relative times absolute
            dash.time = getTimeSrv().timeRange();
            // Remove links
            dash.links = [];
            // remove panel queries & links
            dash.panels.forEach((panel) => {
                panel.targets = [];
                panel.links = [];
                panel.datasource = null;
            });
            // remove annotation queries
            const annotations = dash.annotations.list.filter((annotation) => annotation.enable);
            dash.annotations.list = annotations.map((annotation) => {
                return {
                    name: annotation.name,
                    enable: annotation.enable,
                    iconColor: annotation.iconColor,
                    snapshotData: annotation.snapshotData,
                    type: annotation.type,
                    builtIn: annotation.builtIn,
                    hide: annotation.hide,
                };
            });
            // remove template queries
            dash.getVariables().forEach((variable) => {
                if ('query' in variable) {
                    variable.query = '';
                }
                if ('options' in variable) {
                    variable.options = variable.current && !isEmptyObject(variable.current) ? [variable.current] : [];
                }
                if ('refresh' in variable) {
                    variable.refresh = VariableRefresh.never;
                }
            });
            // snapshot single panel
            if (panel) {
                const singlePanel = panel.getSaveModel();
                singlePanel.gridPos.w = 24;
                singlePanel.gridPos.x = 0;
                singlePanel.gridPos.y = 0;
                singlePanel.gridPos.h = 20;
                dash.panels = [singlePanel];
            }
            // cleanup snapshotData
            delete this.dashboard.snapshot;
            this.dashboard.forEachPanel((panel) => {
                delete panel.snapshotData;
            });
            this.dashboard.annotations.list.forEach((annotation) => {
                delete annotation.snapshotData;
            });
        };
        this.deleteSnapshot = () => __awaiter(this, void 0, void 0, function* () {
            const { deleteUrl } = this.state;
            yield getBackendSrv().get(deleteUrl);
            this.setState({ step: 3 });
        });
        this.getSnapshotUrl = () => {
            return this.state.snapshotUrl;
        };
        this.onSnapshotNameChange = (event) => {
            this.setState({ snapshotName: event.target.value });
        };
        this.onTimeoutChange = (event) => {
            this.setState({ timeoutSeconds: Number(event.target.value) });
        };
        this.onExpireChange = (option) => {
            this.setState({
                selectedExpireOption: option,
                snapshotExpires: option.value,
            });
        };
        this.dashboard = props.dashboard;
        this.expireOptions = [
            {
                label: t('share-modal.snapshot.expire-never', `Never`),
                value: 0,
            },
            {
                label: t('share-modal.snapshot.expire-hour', `1 Hour`),
                value: 60 * 60,
            },
            {
                label: t('share-modal.snapshot.expire-day', `1 Day`),
                value: 60 * 60 * 24,
            },
            {
                label: t('share-modal.snapshot.expire-week', `7 Days`),
                value: 60 * 60 * 24 * 7,
            },
        ];
        this.state = {
            isLoading: false,
            step: 1,
            selectedExpireOption: this.expireOptions[0],
            snapshotExpires: this.expireOptions[0].value,
            snapshotName: props.dashboard.title,
            // @PERCONA
            // increase timeout to 30 seconds
            timeoutSeconds: 30,
            snapshotUrl: '',
            deleteUrl: '',
            externalEnabled: false,
            sharingButtonText: '',
        };
    }
    componentDidMount() {
        this.getSnaphotShareOptions();
    }
    getSnaphotShareOptions() {
        return __awaiter(this, void 0, void 0, function* () {
            const shareOptions = yield getBackendSrv().get('/api/snapshot/shared-options');
            this.setState({
                sharingButtonText: shareOptions['externalSnapshotName'],
                externalEnabled: shareOptions['externalEnabled'],
            });
        });
    }
    renderStep1() {
        const { onDismiss } = this.props;
        const { snapshotName, selectedExpireOption, timeoutSeconds, isLoading, sharingButtonText, externalEnabled } = this.state;
        const snapshotNameTranslation = t('share-modal.snapshot.name', `Snapshot name`);
        const expireTranslation = t('share-modal.snapshot.expire', `Expire`);
        const timeoutTranslation = t('share-modal.snapshot.timeout', `Timeout (seconds)`);
        const timeoutDescriptionTranslation = t('share-modal.snapshot.timeout-description', `You might need to configure the timeout value if it takes a long time to collect your dashboard metrics.`);
        return (React.createElement(React.Fragment, null,
            React.createElement("div", null,
                React.createElement("p", { className: "share-modal-info-text" },
                    React.createElement(Trans, { i18nKey: "share-modal.snapshot.info-text-1" }, "A snapshot is an instant way to share an interactive dashboard publicly. When created, we strip sensitive data like queries (metric, template, and annotation) and panel links, leaving only the visible metric data and series names embedded in your dashboard.")),
                React.createElement("p", { className: "share-modal-info-text" },
                    React.createElement(Trans, { i18nKey: "share-modal.snapshot.info-text-2" },
                        "Keep in mind, your snapshot ",
                        React.createElement("em", null, "can be viewed by anyone"),
                        " that has the link and can access the URL. Share wisely."))),
            React.createElement(Field, { label: snapshotNameTranslation },
                React.createElement(Input, { id: "snapshot-name-input", width: 30, value: snapshotName, onChange: this.onSnapshotNameChange })),
            React.createElement(Field, { label: expireTranslation },
                React.createElement(Select, { inputId: "expire-select-input", width: 30, options: this.expireOptions, value: selectedExpireOption, onChange: this.onExpireChange })),
            React.createElement(Field, { label: timeoutTranslation, description: timeoutDescriptionTranslation },
                React.createElement(Input, { id: "timeout-input", type: "number", width: 21, value: timeoutSeconds, onChange: this.onTimeoutChange })),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { variant: "secondary", onClick: onDismiss, fill: "outline" },
                    React.createElement(Trans, { i18nKey: "share-modal.snapshot.cancel-button" }, "Cancel")),
                externalEnabled && (React.createElement(Button, { variant: "secondary", disabled: isLoading, onClick: this.createSnapshot(true) }, sharingButtonText)),
                React.createElement(Button, { variant: "primary", disabled: isLoading, onClick: this.createSnapshot() },
                    React.createElement(Trans, { i18nKey: "share-modal.snapshot.local-button" }, "Local Snapshot")))));
    }
    renderStep2() {
        const { snapshotUrl } = this.state;
        return (React.createElement(React.Fragment, null,
            React.createElement(Field, { label: t('share-modal.snapshot.url-label', 'Snapshot URL') },
                React.createElement(Input, { id: "snapshot-url-input", value: snapshotUrl, readOnly: true, addonAfter: React.createElement(ClipboardButton, { icon: "copy", variant: "primary", getText: this.getSnapshotUrl },
                        React.createElement(Trans, { i18nKey: "share-modal.snapshot.copy-link-button" }, "Copy")) })),
            React.createElement("div", { className: "pull-right", style: { padding: '5px' } },
                React.createElement(Trans, { i18nKey: "share-modal.snapshot.mistake-message" }, "Did you make a mistake? "),
                "\u00A0",
                React.createElement(LinkButton, { fill: "text", target: "_blank", onClick: this.deleteSnapshot },
                    React.createElement(Trans, { i18nKey: "share-modal.snapshot.delete-button" }, "Delete snapshot.")))));
    }
    renderStep3() {
        return (React.createElement("div", { className: "share-modal-header" },
            React.createElement("p", { className: "share-modal-info-text" },
                React.createElement(Trans, { i18nKey: "share-modal.snapshot.deleted-message" }, "The snapshot has been deleted. If you have already accessed it once, then it might take up to an hour before before it is removed from browser caches or CDN caches."))));
    }
    render() {
        const { isLoading, step } = this.state;
        return (React.createElement(React.Fragment, null,
            step === 1 && this.renderStep1(),
            step === 2 && this.renderStep2(),
            step === 3 && this.renderStep3(),
            isLoading && React.createElement(Spinner, { inline: true })));
    }
}
//# sourceMappingURL=ShareSnapshot.js.map