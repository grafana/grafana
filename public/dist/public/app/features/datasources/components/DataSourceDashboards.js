import React, { useEffect } from 'react';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { importDashboard, removeDashboard } from 'app/features/dashboard/state/actions';
import { loadPluginDashboards } from 'app/features/plugins/admin/state/actions';
import { useDispatch, useSelector } from 'app/types';
import DashboardTable from '../components/DashboardsTable';
import { useInitDataSourceSettings } from '../state';
export function DataSourceDashboards({ uid }) {
    useInitDataSourceSettings(uid);
    const dispatch = useDispatch();
    const dataSource = useSelector((s) => s.dataSources.dataSource);
    const dashboards = useSelector((s) => s.plugins.dashboards);
    const isLoading = useSelector((s) => s.plugins.isLoadingPluginDashboards);
    useEffect(() => {
        // Load plugin dashboards only when the datasource has loaded
        if (dataSource.id > 0) {
            dispatch(loadPluginDashboards());
        }
    }, [dispatch, dataSource.id]);
    const onImportDashboard = (dashboard, overwrite) => {
        dispatch(importDashboard({
            pluginId: dashboard.pluginId,
            path: dashboard.path,
            overwrite,
            inputs: [
                {
                    name: '*',
                    type: 'datasource',
                    pluginId: dataSource.type,
                    value: dataSource.name,
                },
            ],
        }, dashboard.title));
    };
    const onRemoveDashboard = ({ uid }) => {
        dispatch(removeDashboard(uid));
    };
    return (React.createElement(DataSourceDashboardsView, { dashboards: dashboards, isLoading: isLoading, onImportDashboard: onImportDashboard, onRemoveDashboard: onRemoveDashboard }));
}
export const DataSourceDashboardsView = ({ isLoading, dashboards, onImportDashboard, onRemoveDashboard, }) => {
    if (isLoading) {
        return React.createElement(PageLoader, null);
    }
    return React.createElement(DashboardTable, { dashboards: dashboards, onImport: onImportDashboard, onRemove: onRemoveDashboard });
};
//# sourceMappingURL=DataSourceDashboards.js.map