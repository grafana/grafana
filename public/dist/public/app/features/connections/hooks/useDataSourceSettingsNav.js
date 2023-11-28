import { useLocation, useParams } from 'react-router-dom';
import { getDataSourceSrv } from '@grafana/runtime';
import { getNavModel } from 'app/core/selectors/navModel';
import { useDataSource, useDataSourceMeta, useDataSourceSettings } from 'app/features/datasources/state/hooks';
import { getDataSourceLoadingNav, buildNavModel, getDataSourceNav } from 'app/features/datasources/state/navModel';
import { useGetSingle } from 'app/features/plugins/admin/state/hooks';
import { useSelector } from 'app/types';
export function useDataSourceSettingsNav(pageIdParam) {
    var _a, _b, _c;
    const { uid } = useParams();
    const location = useLocation();
    const datasource = useDataSource(uid);
    const dataSourceMeta = useDataSourceMeta(datasource.type);
    const datasourcePlugin = useGetSingle(datasource.type);
    const params = new URLSearchParams(location.search);
    const pageId = pageIdParam || params.get('page');
    const { plugin, loadError, loading } = useDataSourceSettings();
    const dsi = (_a = getDataSourceSrv()) === null || _a === void 0 ? void 0 : _a.getInstanceSettings(uid);
    const hasAlertingEnabled = Boolean((_c = (_b = dsi === null || dsi === void 0 ? void 0 : dsi.meta) === null || _b === void 0 ? void 0 : _b.alerting) !== null && _c !== void 0 ? _c : false);
    const isAlertManagerDatasource = (dsi === null || dsi === void 0 ? void 0 : dsi.type) === 'alertmanager';
    const alertingSupported = hasAlertingEnabled || isAlertManagerDatasource;
    const navIndex = useSelector((state) => state.navIndex);
    const navIndexId = pageId ? `datasource-${pageId}-${uid}` : `datasource-settings-${uid}`;
    let pageNav = {
        node: {
            text: 'Data Source Nav Node',
        },
        main: {
            text: 'Data Source Nav Node',
        },
    };
    if (loadError) {
        const node = {
            text: loadError,
            subTitle: 'Data Source Error',
            icon: 'exclamation-triangle',
        };
        pageNav = {
            node: node,
            main: node,
        };
    }
    if (loading || !plugin) {
        pageNav = getNavModel(navIndex, navIndexId, getDataSourceLoadingNav('settings'));
    }
    if (plugin) {
        pageNav = getNavModel(navIndex, navIndexId, getDataSourceNav(buildNavModel(datasource, plugin), pageId || 'settings'));
    }
    const connectionsPageNav = Object.assign(Object.assign({}, pageNav.main), { dataSourcePluginName: (datasourcePlugin === null || datasourcePlugin === void 0 ? void 0 : datasourcePlugin.name) || (plugin === null || plugin === void 0 ? void 0 : plugin.meta.name) || '', active: true, text: datasource.name, subTitle: `Type: ${dataSourceMeta.name}`, children: (pageNav.main.children || []).map((navModelItem) => {
            var _a;
            return (Object.assign(Object.assign({}, navModelItem), { url: (_a = navModelItem.url) === null || _a === void 0 ? void 0 : _a.replace('datasources/edit/', '/connections/datasources/edit/') }));
        }) });
    return {
        navId: 'connections-datasources',
        pageNav: connectionsPageNav,
        dataSourceHeader: {
            alertingSupported,
        },
    };
}
//# sourceMappingURL=useDataSourceSettingsNav.js.map