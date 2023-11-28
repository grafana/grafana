import { __awaiter } from "tslib";
import saveAs from 'file-saver';
import React from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { config, getBackendSrv } from '@grafana/runtime';
import { SceneObjectBase } from '@grafana/scenes';
import { Button, ClipboardButton, CodeEditor, Field, Modal, Switch, VerticalGroup } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { DashboardExporter } from 'app/features/dashboard/components/DashExportModal';
import { trackDashboardSharingActionPerType } from 'app/features/dashboard/components/ShareModal/analytics';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';
import { DashboardModel } from 'app/features/dashboard/state';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
const exportExternallyTranslation = t('share-modal.export.share-externally-label', `Export for sharing externally`);
const exportDefaultTranslation = t('share-modal.export.share-default-label', `Export with default values removed`);
export class ShareExportTab extends SceneObjectBase {
    constructor(state) {
        super(Object.assign({ isSharingExternally: false, shouldTrimDefaults: false, isViewingJSON: false }, state));
        this._exporter = new DashboardExporter();
        this.onShareExternallyChange = () => {
            this.setState({
                isSharingExternally: !this.state.isSharingExternally,
            });
        };
        this.onTrimDefaultsChange = () => {
            this.setState({
                shouldTrimDefaults: !this.state.shouldTrimDefaults,
            });
        };
        this.onViewJSON = () => {
            this.setState({
                isViewingJSON: !this.state.isViewingJSON,
            });
        };
    }
    getTabLabel() {
        return t('share-modal.tab-title.export', 'Export');
    }
    getClipboardText() {
        return;
    }
    getExportableDashboardJson() {
        return __awaiter(this, void 0, void 0, function* () {
            const { dashboardRef, isSharingExternally, shouldTrimDefaults } = this.state;
            const saveModel = transformSceneToSaveModel(dashboardRef.resolve());
            const exportable = isSharingExternally
                ? yield this._exporter.makeExportable(new DashboardModel(saveModel))
                : saveModel;
            if (shouldTrimDefaults) {
                const trimmed = yield getBackendSrv().post('/api/dashboards/trim', { dashboard: exportable });
                return trimmed.dashboard;
            }
            else {
                return exportable;
            }
        });
    }
    onSaveAsFile() {
        return __awaiter(this, void 0, void 0, function* () {
            const dashboardJson = yield this.getExportableDashboardJson();
            const dashboardJsonPretty = JSON.stringify(dashboardJson, null, 2);
            const blob = new Blob([dashboardJsonPretty], {
                type: 'application/json;charset=utf-8',
            });
            const time = new Date().getTime();
            saveAs(blob, `${dashboardJson.title}-${time}.json`);
            trackDashboardSharingActionPerType('save_export', shareDashboardType.export);
        });
    }
}
ShareExportTab.Component = ShareExportTabRenderer;
function ShareExportTabRenderer({ model }) {
    const { isSharingExternally, shouldTrimDefaults, isViewingJSON, modalRef } = model.useState();
    const dashboardJson = useAsync(() => __awaiter(this, void 0, void 0, function* () {
        if (isViewingJSON) {
            const json = yield model.getExportableDashboardJson();
            return JSON.stringify(json, null, 2);
        }
        return '';
    }), [isViewingJSON]);
    return (React.createElement(React.Fragment, null,
        !isViewingJSON && (React.createElement(React.Fragment, null,
            React.createElement("p", { className: "share-modal-info-text" },
                React.createElement(Trans, { i18nKey: "share-modal.export.info-text" }, "Export this dashboard.")),
            React.createElement(VerticalGroup, { spacing: "md" },
                React.createElement(Field, { label: exportExternallyTranslation },
                    React.createElement(Switch, { id: "share-externally-toggle", value: isSharingExternally, onChange: model.onShareExternallyChange })),
                config.featureToggles.trimDefaults && (React.createElement(Field, { label: exportDefaultTranslation },
                    React.createElement(Switch, { id: "trim-defaults-toggle", value: shouldTrimDefaults, onChange: model.onTrimDefaultsChange })))),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { variant: "secondary", onClick: () => {
                        modalRef === null || modalRef === void 0 ? void 0 : modalRef.resolve().onDismiss();
                    }, fill: "outline" },
                    React.createElement(Trans, { i18nKey: "share-modal.export.cancel-button" }, "Cancel")),
                React.createElement(Button, { variant: "secondary", icon: "brackets-curly", onClick: model.onViewJSON },
                    React.createElement(Trans, { i18nKey: "share-modal.export.view-button" }, "View JSON")),
                React.createElement(Button, { variant: "primary", icon: "save", onClick: () => model.onSaveAsFile() },
                    React.createElement(Trans, { i18nKey: "share-modal.export.save-button" }, "Save to file"))))),
        isViewingJSON && (React.createElement(React.Fragment, null,
            React.createElement(AutoSizer, { disableHeight: true }, ({ width }) => {
                var _a;
                if (dashboardJson.value) {
                    return (React.createElement(CodeEditor, { value: (_a = dashboardJson.value) !== null && _a !== void 0 ? _a : '', language: "json", showMiniMap: false, height: "500px", width: width }));
                }
                if (dashboardJson.loading) {
                    return React.createElement("div", null, "Loading...");
                }
                return null;
            }),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { variant: "secondary", fill: "outline", onClick: model.onViewJSON, icon: "arrow-left" },
                    React.createElement(Trans, { i18nKey: "share-modal.export.back-button" }, "Back to export config")),
                React.createElement(ClipboardButton, { variant: "secondary", icon: "copy", disabled: dashboardJson.loading, getText: () => { var _a; return (_a = dashboardJson.value) !== null && _a !== void 0 ? _a : ''; } },
                    React.createElement(Trans, { i18nKey: "share-modal.view-json.copy-button" }, "Copy to Clipboard")),
                React.createElement(Button, { variant: "primary", icon: "save", disabled: dashboardJson.loading, onClick: () => model.onSaveAsFile() },
                    React.createElement(Trans, { i18nKey: "share-modal.export.save-button" }, "Save to file")))))));
}
//# sourceMappingURL=ShareExportTab.js.map