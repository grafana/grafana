import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { dateTimeFormat } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Form, Legend } from '@grafana/ui';
import { clearLoadedDashboard, importDashboard } from '../state/actions';
import { DashboardSource } from '../state/reducers';
import { ImportDashboardForm } from './ImportDashboardForm';
const IMPORT_FINISHED_EVENT_NAME = 'dashboard_import_imported';
const mapStateToProps = (state) => {
    const searchObj = locationService.getSearchObject();
    return {
        dashboard: state.importDashboard.dashboard,
        meta: state.importDashboard.meta,
        source: state.importDashboard.source,
        inputs: state.importDashboard.inputs,
        folder: searchObj.folderUid ? { uid: String(searchObj.folderUid) } : { uid: '' },
    };
};
const mapDispatchToProps = {
    clearLoadedDashboard,
    importDashboard,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
class ImportDashboardOverviewUnConnected extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            uidReset: false,
        };
        this.onSubmit = (form) => {
            reportInteraction(IMPORT_FINISHED_EVENT_NAME);
            this.props.importDashboard(form);
        };
        this.onCancel = () => {
            this.props.clearLoadedDashboard();
        };
        this.onUidReset = () => {
            this.setState({ uidReset: true });
        };
    }
    render() {
        const { dashboard, inputs, meta, source, folder } = this.props;
        const { uidReset } = this.state;
        return (React.createElement(React.Fragment, null,
            source === DashboardSource.Gcom && (React.createElement("div", { style: { marginBottom: '24px' } },
                React.createElement("div", null,
                    React.createElement(Legend, null,
                        "Importing dashboard from",
                        ' ',
                        React.createElement("a", { href: `https://grafana.com/dashboards/${dashboard.gnetId}`, className: "external-link", target: "_blank", rel: "noreferrer" }, "Grafana.com"))),
                React.createElement("table", { className: "filter-table form-inline" },
                    React.createElement("tbody", null,
                        React.createElement("tr", null,
                            React.createElement("td", null, "Published by"),
                            React.createElement("td", null, meta.orgName)),
                        React.createElement("tr", null,
                            React.createElement("td", null, "Updated on"),
                            React.createElement("td", null, dateTimeFormat(meta.updatedAt))))))),
            React.createElement(Form, { onSubmit: this.onSubmit, defaultValues: Object.assign(Object.assign({}, dashboard), { constants: [], dataSources: [], elements: [], folder: folder }), validateOnMount: true, validateFieldsOnMount: ['title', 'uid'], validateOn: "onChange" }, ({ register, errors, control, watch, getValues }) => (React.createElement(ImportDashboardForm, { register: register, errors: errors, control: control, getValues: getValues, uidReset: uidReset, inputs: inputs, onCancel: this.onCancel, onUidReset: this.onUidReset, onSubmit: this.onSubmit, watch: watch, initialFolderUid: folder.uid })))));
    }
}
export const ImportDashboardOverview = connector(ImportDashboardOverviewUnConnected);
ImportDashboardOverview.displayName = 'ImportDashboardOverview';
//# sourceMappingURL=ImportDashboardOverview.js.map