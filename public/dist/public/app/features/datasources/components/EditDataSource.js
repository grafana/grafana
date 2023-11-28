import { __awaiter } from "tslib";
import { omit } from 'lodash';
import React, { useMemo } from 'react';
import { DataSourcePluginContextProvider, PluginExtensionPoints, DataSourceUpdatedSuccessfully, } from '@grafana/data';
import { getDataSourceSrv, getPluginComponentExtensions } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { useDispatch } from 'app/types';
import { dataSourceLoaded, setDataSourceName, setIsDefault, useDataSource, useDataSourceExploreUrl, useDataSourceMeta, useDataSourceRights, useDataSourceSettings, useDeleteLoadedDataSource, useInitDataSourceSettings, useTestDataSource, useUpdateDatasource, } from '../state';
import { trackDsConfigClicked, trackDsConfigUpdated } from '../tracking';
import { BasicSettings } from './BasicSettings';
import { ButtonRow } from './ButtonRow';
import { CloudInfoBox } from './CloudInfoBox';
import { DataSourceLoadError } from './DataSourceLoadError';
import { DataSourceMissingRightsMessage } from './DataSourceMissingRightsMessage';
import { DataSourcePluginConfigPage } from './DataSourcePluginConfigPage';
import { DataSourcePluginSettings } from './DataSourcePluginSettings';
import { DataSourcePluginState } from './DataSourcePluginState';
import { DataSourceReadOnlyMessage } from './DataSourceReadOnlyMessage';
import { DataSourceTestingStatus } from './DataSourceTestingStatus';
export function EditDataSource({ uid, pageId }) {
    useInitDataSourceSettings(uid);
    const dispatch = useDispatch();
    const dataSource = useDataSource(uid);
    const dataSourceMeta = useDataSourceMeta(dataSource.type);
    const dataSourceSettings = useDataSourceSettings();
    const dataSourceRights = useDataSourceRights(uid);
    const exploreUrl = useDataSourceExploreUrl(uid);
    const onDelete = useDeleteLoadedDataSource();
    const onTest = useTestDataSource(uid);
    const onUpdate = useUpdateDatasource();
    const onDefaultChange = (value) => dispatch(setIsDefault(value));
    const onNameChange = (name) => dispatch(setDataSourceName(name));
    const onOptionsChange = (ds) => dispatch(dataSourceLoaded(ds));
    return (React.createElement(EditDataSourceView, { pageId: pageId, dataSource: dataSource, dataSourceMeta: dataSourceMeta, dataSourceSettings: dataSourceSettings, dataSourceRights: dataSourceRights, exploreUrl: exploreUrl, onDelete: onDelete, onDefaultChange: onDefaultChange, onNameChange: onNameChange, onOptionsChange: onOptionsChange, onTest: onTest, onUpdate: onUpdate }));
}
export function EditDataSourceView({ pageId, dataSource, dataSourceMeta, dataSourceSettings, dataSourceRights, exploreUrl, onDelete, onDefaultChange, onNameChange, onOptionsChange, onTest, onUpdate, }) {
    var _a, _b, _c;
    const { plugin, loadError, testingStatus, loading } = dataSourceSettings;
    const { readOnly, hasWriteRights, hasDeleteRights } = dataSourceRights;
    const hasDataSource = dataSource.id > 0;
    const dsi = (_a = getDataSourceSrv()) === null || _a === void 0 ? void 0 : _a.getInstanceSettings(dataSource.uid);
    const hasAlertingEnabled = Boolean((_c = (_b = dsi === null || dsi === void 0 ? void 0 : dsi.meta) === null || _b === void 0 ? void 0 : _b.alerting) !== null && _c !== void 0 ? _c : false);
    const isAlertManagerDatasource = (dsi === null || dsi === void 0 ? void 0 : dsi.type) === 'alertmanager';
    const alertingSupported = hasAlertingEnabled || isAlertManagerDatasource;
    const onSubmit = (e) => __awaiter(this, void 0, void 0, function* () {
        e.preventDefault();
        trackDsConfigClicked('save_and_test');
        try {
            yield onUpdate(Object.assign({}, dataSource));
            trackDsConfigUpdated({ item: 'success' });
            appEvents.publish(new DataSourceUpdatedSuccessfully());
        }
        catch (error) {
            trackDsConfigUpdated({ item: 'fail', error });
            return;
        }
        onTest();
    });
    const extensions = useMemo(() => {
        const allowedPluginIds = ['grafana-pdc-app', 'grafana-auth-app'];
        const extensionPointId = PluginExtensionPoints.DataSourceConfig;
        const { extensions } = getPluginComponentExtensions({ extensionPointId });
        return extensions.filter((e) => allowedPluginIds.includes(e.pluginId));
    }, []);
    if (loadError) {
        return (React.createElement(DataSourceLoadError, { dataSourceRights: dataSourceRights, onDelete: () => {
                trackDsConfigClicked('delete');
                onDelete();
            } }));
    }
    if (loading) {
        return React.createElement(PageLoader, null);
    }
    // TODO - is this needed?
    if (!hasDataSource || !dsi) {
        return null;
    }
    if (pageId) {
        return (React.createElement(DataSourcePluginContextProvider, { instanceSettings: dsi },
            React.createElement(DataSourcePluginConfigPage, { pageId: pageId, plugin: plugin })));
    }
    return (React.createElement("form", { onSubmit: onSubmit },
        !hasWriteRights && React.createElement(DataSourceMissingRightsMessage, null),
        readOnly && React.createElement(DataSourceReadOnlyMessage, null),
        dataSourceMeta.state && React.createElement(DataSourcePluginState, { state: dataSourceMeta.state }),
        React.createElement(CloudInfoBox, { dataSource: dataSource }),
        React.createElement(BasicSettings, { dataSourceName: dataSource.name, isDefault: dataSource.isDefault, onDefaultChange: onDefaultChange, onNameChange: onNameChange, alertingSupported: alertingSupported, disabled: readOnly || !hasWriteRights }),
        plugin && (React.createElement(DataSourcePluginContextProvider, { instanceSettings: dsi },
            React.createElement(DataSourcePluginSettings, { plugin: plugin, dataSource: dataSource, dataSourceMeta: dataSourceMeta, onModelChange: onOptionsChange }))),
        extensions.map((extension) => {
            const Component = extension.component;
            return (React.createElement("div", { key: extension.id },
                React.createElement(Component, { context: {
                        dataSource: omit(dataSource, ['secureJsonData']),
                        dataSourceMeta: dataSourceMeta,
                        testingStatus,
                        setJsonData: (jsonData) => onOptionsChange(Object.assign(Object.assign({}, dataSource), { jsonData: Object.assign(Object.assign({}, dataSource.jsonData), jsonData) })),
                    } })));
        }),
        React.createElement(DataSourceTestingStatus, { testingStatus: testingStatus, exploreUrl: exploreUrl, dataSource: dataSource }),
        React.createElement(ButtonRow, { onSubmit: onSubmit, onDelete: () => {
                trackDsConfigClicked('delete');
                onDelete();
            }, onTest: () => {
                trackDsConfigClicked('test');
                onTest();
            }, canDelete: !readOnly && hasDeleteRights, canSave: !readOnly && hasWriteRights })));
}
//# sourceMappingURL=EditDataSource.js.map