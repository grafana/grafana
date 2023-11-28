import { __awaiter } from "tslib";
import { extend } from 'lodash';
import React, { PureComponent } from 'react';
import { AppEvents } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { appEvents } from 'app/core/core';
import DashboardsTable from 'app/features/datasources/components/DashboardsTable';
export class PluginDashboards extends PureComponent {
    constructor(props) {
        super(props);
        this.importAll = () => {
            this.importNext(0);
        };
        this.importNext = (index) => {
            const { dashboards } = this.state;
            return this.import(dashboards[index], true).then(() => {
                if (index + 1 < dashboards.length) {
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            this.importNext(index + 1).then(() => {
                                resolve();
                            });
                        }, 500);
                    });
                }
                else {
                    return Promise.resolve();
                }
            });
        };
        this.import = (dash, overwrite) => {
            const { plugin, datasource } = this.props;
            const installCmd = {
                pluginId: plugin.id,
                path: dash.path,
                overwrite: overwrite,
                inputs: datasource
                    ? [
                        {
                            name: '*',
                            type: 'datasource',
                            pluginId: datasource.meta.id,
                            value: datasource.name,
                        },
                    ]
                    : [],
            };
            return getBackendSrv()
                .post(`/api/dashboards/import`, installCmd)
                .then((res) => {
                appEvents.emit(AppEvents.alertSuccess, ['Dashboard Imported', dash.title]);
                extend(dash, res);
                this.setState({ dashboards: [...this.state.dashboards] });
            });
        };
        this.remove = (dash) => {
            getBackendSrv()
                .delete('/api/dashboards/uid/' + dash.uid)
                .then(() => {
                dash.imported = false;
                this.setState({ dashboards: [...this.state.dashboards] });
            });
        };
        this.state = {
            loading: true,
            dashboards: [],
        };
    }
    componentDidMount() {
        return __awaiter(this, void 0, void 0, function* () {
            const pluginId = this.props.plugin.id;
            getBackendSrv()
                .get(`/api/plugins/${pluginId}/dashboards`)
                .then((dashboards) => {
                this.setState({ dashboards, loading: false });
            });
        });
    }
    render() {
        const { loading, dashboards } = this.state;
        if (loading) {
            return React.createElement("div", null, "loading...");
        }
        if (!dashboards || !dashboards.length) {
            return React.createElement("div", null, "No dashboards are included with this plugin");
        }
        return (React.createElement("div", { className: "gf-form-group" },
            React.createElement(DashboardsTable, { dashboards: dashboards, onImport: this.import, onRemove: this.remove })));
    }
}
//# sourceMappingURL=PluginDashboards.js.map