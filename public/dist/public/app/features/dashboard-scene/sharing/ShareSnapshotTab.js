import { __awaiter } from "tslib";
import React from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { getBackendSrv } from '@grafana/runtime';
import { sceneGraph, SceneObjectBase } from '@grafana/scenes';
import { Button, ClipboardButton, Field, Input, Modal, RadioButtonGroup } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { trackDashboardSharingActionPerType } from 'app/features/dashboard/components/ShareModal/analytics';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';
import { transformSceneToSaveModel, trimDashboardForSnapshot } from '../serialization/transformSceneToSaveModel';
const SNAPSHOTS_API_ENDPOINT = '/api/snapshots';
const DEFAULT_EXPIRE_OPTION = {
    label: t('share-modal.snapshot.expire-never', `Never`),
    value: 0,
};
const EXPIRE_OPTIONS = [
    DEFAULT_EXPIRE_OPTION,
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
export class ShareSnapshotTab extends SceneObjectBase {
    constructor(state) {
        super(Object.assign(Object.assign({}, state), { snapshotName: state.dashboardRef.resolve().state.title, selectedExpireOption: DEFAULT_EXPIRE_OPTION }));
        this.onSnasphotNameChange = (snapshotName) => {
            this.setState({ snapshotName: snapshotName.trim() });
        };
        this.onExpireChange = (option) => {
            this.setState({
                selectedExpireOption: EXPIRE_OPTIONS.find((o) => o.value === option),
            });
        };
        this.onSnapshotCreate = (external = false) => __awaiter(this, void 0, void 0, function* () {
            const { selectedExpireOption } = this.state;
            const snapshot = this.prepareSnapshot();
            // TODO
            // snapshot.snapshot = {
            //   originalUrl: window.location.href,
            // };
            const cmdData = {
                dashboard: snapshot,
                name: snapshot.title,
                expires: selectedExpireOption === null || selectedExpireOption === void 0 ? void 0 : selectedExpireOption.value,
                external,
            };
            try {
                const results = yield getBackendSrv().post(SNAPSHOTS_API_ENDPOINT, cmdData);
                return results;
            }
            finally {
                trackDashboardSharingActionPerType(external ? 'publish_snapshot' : 'local_snapshot', shareDashboardType.snapshot);
            }
        });
        this.addActivationHandler(() => {
            this._onActivate();
        });
    }
    _onActivate() {
        getBackendSrv()
            .get('/api/snapshot/shared-options')
            .then((shareOptions) => {
            if (this.isActive) {
                this.setState({
                    snapshotSharingOptions: shareOptions,
                });
            }
        });
    }
    getTabLabel() {
        return t('share-modal.tab-title.snapshot', 'Snapshot');
    }
    prepareSnapshot() {
        const timeRange = sceneGraph.getTimeRange(this);
        const { dashboardRef, panelRef } = this.state;
        const saveModel = transformSceneToSaveModel(dashboardRef.resolve(), true);
        return trimDashboardForSnapshot(this.state.snapshotName || '', timeRange.state.value, saveModel, panelRef === null || panelRef === void 0 ? void 0 : panelRef.resolve());
    }
}
ShareSnapshotTab.Component = ShareSnapshoTabRenderer;
function ShareSnapshoTabRenderer({ model }) {
    const { snapshotName, selectedExpireOption, modalRef, snapshotSharingOptions } = model.useState();
    const [snapshotResult, createSnapshot] = useAsyncFn((external = false) => __awaiter(this, void 0, void 0, function* () {
        return model.onSnapshotCreate(external);
    }));
    const [deleteSnapshotResult, deleteSnapshot] = useAsyncFn((url) => __awaiter(this, void 0, void 0, function* () {
        return yield getBackendSrv().get(url);
    }));
    // If snapshot has been deleted - show message and allow to close modal
    if (deleteSnapshotResult.value) {
        return (React.createElement(Trans, { i18nKey: "share-modal.snapshot.deleted-message" }, "The snapshot has been deleted. If you have already accessed it once, then it might take up to an hour before before it is removed from browser caches or CDN caches."));
    }
    return (React.createElement(React.Fragment, null,
        !Boolean(snapshotResult.value) && (React.createElement(React.Fragment, null,
            React.createElement("div", null,
                React.createElement("p", { className: "share-modal-info-text" },
                    React.createElement(Trans, { i18nKey: "share-modal.snapshot.info-text-1" }, "A snapshot is an instant way to share an interactive dashboard publicly. When created, we strip sensitive data like queries (metric, template, and annotation) and panel links, leaving only the visible metric data and series names embedded in your dashboard.")),
                React.createElement("p", { className: "share-modal-info-text" },
                    React.createElement(Trans, { i18nKey: "share-modal.snapshot.info-text-2" },
                        "Keep in mind, your snapshot ",
                        React.createElement("em", null, "can be viewed by anyone"),
                        " that has the link and can access the URL. Share wisely."))),
            React.createElement(Field, { label: t('share-modal.snapshot.name', `Snapshot name`) },
                React.createElement(Input, { id: "snapshot-name-input", width: 30, defaultValue: snapshotName, onBlur: (e) => model.onSnasphotNameChange(e.target.value) })),
            React.createElement(Field, { label: t('share-modal.snapshot.expire', `Expire`) },
                React.createElement(RadioButtonGroup, { id: "expire-select-input", options: EXPIRE_OPTIONS, value: selectedExpireOption === null || selectedExpireOption === void 0 ? void 0 : selectedExpireOption.value, onChange: model.onExpireChange })),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { variant: "secondary", onClick: () => {
                        modalRef === null || modalRef === void 0 ? void 0 : modalRef.resolve().onDismiss();
                    }, fill: "outline" },
                    React.createElement(Trans, { i18nKey: "share-modal.snapshot.cancel-button" }, "Cancel")),
                (snapshotSharingOptions === null || snapshotSharingOptions === void 0 ? void 0 : snapshotSharingOptions.externalEnabled) && (React.createElement(Button, { variant: "secondary", disabled: snapshotResult.loading, onClick: () => createSnapshot(true) }, snapshotSharingOptions === null || snapshotSharingOptions === void 0 ? void 0 : snapshotSharingOptions.externalSnapshotName)),
                React.createElement(Button, { variant: "primary", disabled: snapshotResult.loading, onClick: () => createSnapshot() },
                    React.createElement(Trans, { i18nKey: "share-modal.snapshot.local-button" }, "Local Snapshot"))))),
        snapshotResult.value && (React.createElement(React.Fragment, null,
            React.createElement(Field, { label: t('share-modal.snapshot.url-label', 'Snapshot URL') },
                React.createElement(Input, { id: "snapshot-url-input", value: snapshotResult.value.url, readOnly: true, addonAfter: React.createElement(ClipboardButton, { icon: "copy", variant: "primary", getText: () => snapshotResult.value.url },
                        React.createElement(Trans, { i18nKey: "share-modal.snapshot.copy-link-button" }, "Copy")) })),
            React.createElement("div", { className: "pull-right", style: { padding: '5px' } },
                React.createElement(Trans, { i18nKey: "share-modal.snapshot.mistake-message" }, "Did you make a mistake? "),
                "\u00A0",
                React.createElement(Button, { fill: "outline", size: "md", variant: "destructive", onClick: () => {
                        deleteSnapshot(snapshotResult.value.deleteUrl);
                    } },
                    React.createElement(Trans, { i18nKey: "share-modal.snapshot.delete-button" }, "Delete snapshot.")))))));
}
//# sourceMappingURL=ShareSnapshotTab.js.map