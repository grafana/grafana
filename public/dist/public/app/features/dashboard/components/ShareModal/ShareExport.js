import { saveAs } from 'file-saver';
import React, { PureComponent } from 'react';
import { config } from '@grafana/runtime';
import { Button, Field, Modal, Switch } from '@grafana/ui';
import { appEvents } from 'app/core/core';
import { t, Trans } from 'app/core/internationalization';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { DashboardExporter } from 'app/features/dashboard/components/DashExportModal';
import { ShowModalReactEvent } from 'app/types/events';
import { ViewJsonModal } from './ViewJsonModal';
import { trackDashboardSharingActionPerType } from './analytics';
import { shareDashboardType } from './utils';
export class ShareExport extends PureComponent {
    constructor(props) {
        super(props);
        this.onShareExternallyChange = () => {
            this.setState({
                shareExternally: !this.state.shareExternally,
            });
        };
        this.onTrimDefaultsChange = () => {
            this.setState({
                trimDefaults: !this.state.trimDefaults,
            });
        };
        this.onSaveAsFile = () => {
            const { dashboard } = this.props;
            const { shareExternally } = this.state;
            const { trimDefaults } = this.state;
            if (shareExternally) {
                this.exporter.makeExportable(dashboard).then((dashboardJson) => {
                    if (trimDefaults) {
                        getBackendSrv()
                            .post('/api/dashboards/trim', { dashboard: dashboardJson })
                            .then((resp) => {
                            this.openSaveAsDialog(resp.dashboard);
                        });
                    }
                    else {
                        this.openSaveAsDialog(dashboardJson);
                    }
                });
            }
            else {
                if (trimDefaults) {
                    getBackendSrv()
                        .post('/api/dashboards/trim', { dashboard: dashboard.getSaveModelClone() })
                        .then((resp) => {
                        this.openSaveAsDialog(resp.dashboard);
                    });
                }
                else {
                    this.openSaveAsDialog(dashboard.getSaveModelClone());
                }
            }
        };
        this.onViewJson = () => {
            const { dashboard } = this.props;
            const { shareExternally } = this.state;
            const { trimDefaults } = this.state;
            if (shareExternally) {
                this.exporter.makeExportable(dashboard).then((dashboardJson) => {
                    if (trimDefaults) {
                        getBackendSrv()
                            .post('/api/dashboards/trim', { dashboard: dashboardJson })
                            .then((resp) => {
                            this.openJsonModal(resp.dashboard);
                        });
                    }
                    else {
                        this.openJsonModal(dashboardJson);
                    }
                });
            }
            else {
                if (trimDefaults) {
                    getBackendSrv()
                        .post('/api/dashboards/trim', { dashboard: dashboard.getSaveModelClone() })
                        .then((resp) => {
                        this.openJsonModal(resp.dashboard);
                    });
                }
                else {
                    this.openJsonModal(dashboard.getSaveModelClone());
                }
            }
        };
        this.openSaveAsDialog = (dash) => {
            const dashboardJsonPretty = JSON.stringify(dash, null, 2);
            const blob = new Blob([dashboardJsonPretty], {
                type: 'application/json;charset=utf-8',
            });
            const time = new Date().getTime();
            saveAs(blob, `${dash.title}-${time}.json`);
            trackDashboardSharingActionPerType('save_export', shareDashboardType.export);
        };
        this.openJsonModal = (clone) => {
            var _a, _b;
            appEvents.publish(new ShowModalReactEvent({
                props: {
                    json: JSON.stringify(clone, null, 2),
                },
                component: ViewJsonModal,
            }));
            (_b = (_a = this.props).onDismiss) === null || _b === void 0 ? void 0 : _b.call(_a);
        };
        this.state = {
            shareExternally: false,
            trimDefaults: false,
        };
        this.exporter = new DashboardExporter();
    }
    render() {
        const { onDismiss } = this.props;
        const { shareExternally } = this.state;
        const { trimDefaults } = this.state;
        const exportExternallyTranslation = t('share-modal.export.share-externally-label', `Export for sharing externally`);
        const exportDefaultTranslation = t('share-modal.export.share-default-label', `Export with default values removed`);
        return (React.createElement(React.Fragment, null,
            React.createElement("p", { className: "share-modal-info-text" },
                React.createElement(Trans, { i18nKey: "share-modal.export.info-text" }, "Export this dashboard.")),
            React.createElement(Field, { label: exportExternallyTranslation },
                React.createElement(Switch, { id: "share-externally-toggle", value: shareExternally, onChange: this.onShareExternallyChange })),
            config.featureToggles.trimDefaults && (React.createElement(Field, { label: exportDefaultTranslation },
                React.createElement(Switch, { id: "trim-defaults-toggle", value: trimDefaults, onChange: this.onTrimDefaultsChange }))),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { variant: "secondary", onClick: onDismiss, fill: "outline" },
                    React.createElement(Trans, { i18nKey: "share-modal.export.cancel-button" }, "Cancel")),
                React.createElement(Button, { variant: "secondary", onClick: this.onViewJson },
                    React.createElement(Trans, { i18nKey: "share-modal.export.view-button" }, "View JSON")),
                React.createElement(Button, { variant: "primary", onClick: this.onSaveAsFile },
                    React.createElement(Trans, { i18nKey: "share-modal.export.save-button" }, "Save to file")))));
    }
}
//# sourceMappingURL=ShareExport.js.map