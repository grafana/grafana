import { __awaiter } from "tslib";
import React, { PureComponent } from 'react';
import { getDataSourceRef } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { QueryGroup } from 'app/features/query/components/QueryGroup';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { getDashboardSrv } from '../../services/DashboardSrv';
import { getLastUsedDatasourceFromStorage, initLastUsedDatasourceKeyForDashboard, setLastUsedDatasourceKeyForDashboard, } from '../../utils/dashboard';
export class PanelEditorQueries extends PureComponent {
    constructor(props) {
        super(props);
        // store last used datasource in local storage
        this.updateLastUsedDatasource = (datasource) => {
            var _a, _b;
            if (!datasource.uid) {
                return;
            }
            const dashboardUid = (_b = (_a = getDashboardSrv().getCurrent()) === null || _a === void 0 ? void 0 : _a.uid) !== null && _b !== void 0 ? _b : '';
            // if datasource is MIXED reset datasource uid in storage, because Mixed datasource can contain multiple ds
            if (datasource.uid === MIXED_DATASOURCE_NAME) {
                return initLastUsedDatasourceKeyForDashboard(dashboardUid);
            }
            setLastUsedDatasourceKeyForDashboard(dashboardUid, datasource.uid);
        };
        this.onRunQueries = () => {
            this.props.panel.refresh();
        };
        this.onOpenQueryInspector = () => {
            locationService.partial({
                inspect: this.props.panel.id,
                inspectTab: 'query',
            });
        };
        this.onOptionsChange = (options) => {
            var _a;
            const { panel } = this.props;
            panel.updateQueries(options);
            if (options.dataSource.uid !== ((_a = panel.datasource) === null || _a === void 0 ? void 0 : _a.uid)) {
                // trigger queries when changing data source
                setTimeout(this.onRunQueries, 10);
            }
            this.forceUpdate();
        };
    }
    buildQueryOptions(panel) {
        var _a, _b, _c;
        const dataSource = (_a = panel.datasource) !== null && _a !== void 0 ? _a : {
            default: true,
        };
        const datasourceSettings = getDatasourceSrv().getInstanceSettings(dataSource);
        // store last datasource used in local storage
        this.updateLastUsedDatasource(dataSource);
        return {
            cacheTimeout: ((_b = datasourceSettings === null || datasourceSettings === void 0 ? void 0 : datasourceSettings.meta.queryOptions) === null || _b === void 0 ? void 0 : _b.cacheTimeout) ? panel.cacheTimeout : undefined,
            dataSource: {
                default: datasourceSettings === null || datasourceSettings === void 0 ? void 0 : datasourceSettings.isDefault,
                type: datasourceSettings === null || datasourceSettings === void 0 ? void 0 : datasourceSettings.type,
                uid: datasourceSettings === null || datasourceSettings === void 0 ? void 0 : datasourceSettings.uid,
            },
            queryCachingTTL: ((_c = datasourceSettings === null || datasourceSettings === void 0 ? void 0 : datasourceSettings.cachingConfig) === null || _c === void 0 ? void 0 : _c.enabled) ? panel.queryCachingTTL : undefined,
            queries: panel.targets,
            maxDataPoints: panel.maxDataPoints,
            minInterval: panel.interval,
            timeRange: {
                from: panel.timeFrom,
                shift: panel.timeShift,
                hide: panel.hideTimeOverride,
            },
        };
    }
    componentDidMount() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const { panel } = this.props;
            // If the panel model has no datasource property load the default data source property and update the persisted model
            // Because this part of the panel model is not in redux yet we do a forceUpdate.
            if (!panel.datasource) {
                let ds;
                // check if we have last used datasource from local storage
                // get dashboard uid
                const dashboardUid = (_b = (_a = getDashboardSrv().getCurrent()) === null || _a === void 0 ? void 0 : _a.uid) !== null && _b !== void 0 ? _b : '';
                const lastUsedDatasource = getLastUsedDatasourceFromStorage(dashboardUid);
                // do we have a last used datasource for this dashboard
                if ((lastUsedDatasource === null || lastUsedDatasource === void 0 ? void 0 : lastUsedDatasource.datasourceUid) !== null) {
                    // get datasource from uid
                    ds = getDatasourceSrv().getInstanceSettings(lastUsedDatasource === null || lastUsedDatasource === void 0 ? void 0 : lastUsedDatasource.datasourceUid);
                }
                // else load default datasource
                if (!ds) {
                    ds = getDatasourceSrv().getInstanceSettings(null);
                }
                panel.datasource = getDataSourceRef(ds);
                this.forceUpdate();
            }
        });
    }
    render() {
        const { panel } = this.props;
        // If no panel data soruce set, wait with render. Will be set to default in componentDidMount
        if (!panel.datasource) {
            return null;
        }
        const options = this.buildQueryOptions(panel);
        return (React.createElement(QueryGroup, { options: options, queryRunner: panel.getQueryRunner(), onRunQueries: this.onRunQueries, onOpenQueryInspector: this.onOpenQueryInspector, onOptionsChange: this.onOptionsChange }));
    }
}
//# sourceMappingURL=PanelEditorQueries.js.map