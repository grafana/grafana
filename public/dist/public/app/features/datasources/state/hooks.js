import { __awaiter } from "tslib";
import { useContext, useEffect } from 'react';
import { cleanUpAction } from 'app/core/actions/cleanUp';
import appEvents from 'app/core/app_events';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, useDispatch, useSelector } from 'app/types';
import { ShowConfirmModalEvent } from 'app/types/events';
import { constructDataSourceExploreUrl } from '../utils';
import { initDataSourceSettings, testDataSource, loadDataSource, loadDataSources, loadDataSourcePlugins, addDataSource, updateDataSource, deleteLoadedDataSource, } from './actions';
import { DataSourcesRoutesContext } from './contexts';
import { initialDataSourceSettingsState } from './reducers';
import { getDataSource, getDataSourceMeta } from './selectors';
export const useInitDataSourceSettings = (uid) => {
    const dispatch = useDispatch();
    useEffect(() => {
        dispatch(initDataSourceSettings(uid));
        return function cleanUp() {
            dispatch(cleanUpAction({
                cleanupAction: (state) => (state.dataSourceSettings = initialDataSourceSettingsState),
            }));
        };
    }, [uid, dispatch]);
};
export const useTestDataSource = (uid) => {
    const dispatch = useDispatch();
    const dataSourcesRoutes = useDataSourcesRoutes();
    return () => dispatch(testDataSource(uid, dataSourcesRoutes.Edit));
};
export const useLoadDataSources = () => {
    const dispatch = useDispatch();
    const isLoading = useSelector((state) => state.dataSources.isLoadingDataSources);
    const dataSources = useSelector((state) => state.dataSources.dataSources);
    useEffect(() => {
        dispatch(loadDataSources());
    }, [dispatch]);
    return { isLoading, dataSources };
};
export const useLoadDataSource = (uid) => {
    const dispatch = useDispatch();
    useEffect(() => {
        dispatch(loadDataSource(uid));
    }, [dispatch, uid]);
};
export const useLoadDataSourcePlugins = () => {
    const dispatch = useDispatch();
    useEffect(() => {
        dispatch(loadDataSourcePlugins());
    }, [dispatch]);
};
export const useAddDatasource = () => {
    const dispatch = useDispatch();
    const dataSourcesRoutes = useDataSourcesRoutes();
    return (plugin) => {
        dispatch(addDataSource(plugin, dataSourcesRoutes.Edit));
    };
};
export const useUpdateDatasource = () => {
    const dispatch = useDispatch();
    return (dataSource) => __awaiter(void 0, void 0, void 0, function* () { return dispatch(updateDataSource(dataSource)); });
};
export const useDeleteLoadedDataSource = () => {
    const dispatch = useDispatch();
    const { name } = useSelector((state) => state.dataSources.dataSource);
    return () => {
        appEvents.publish(new ShowConfirmModalEvent({
            title: 'Delete',
            text: `Are you sure you want to delete the "${name}" data source?`,
            yesText: 'Delete',
            icon: 'trash-alt',
            onConfirm: () => dispatch(deleteLoadedDataSource()),
        }));
    };
};
export const useDataSource = (uid) => {
    return useSelector((state) => getDataSource(state.dataSources, uid));
};
export const useDataSourceExploreUrl = (uid) => {
    const dataSource = useDataSource(uid);
    return constructDataSourceExploreUrl(dataSource);
};
export const useDataSourceMeta = (pluginType) => {
    return useSelector((state) => getDataSourceMeta(state.dataSources, pluginType));
};
export const useDataSourceSettings = () => {
    return useSelector((state) => state.dataSourceSettings);
};
export const useDataSourceRights = (uid) => {
    const dataSource = useDataSource(uid);
    const readOnly = dataSource.readOnly === true;
    const hasWriteRights = contextSrv.hasPermissionInMetadata(AccessControlAction.DataSourcesWrite, dataSource);
    const hasDeleteRights = contextSrv.hasPermissionInMetadata(AccessControlAction.DataSourcesDelete, dataSource);
    return {
        readOnly,
        hasWriteRights,
        hasDeleteRights,
    };
};
export const useDataSourcesRoutes = () => {
    return useContext(DataSourcesRoutesContext);
};
//# sourceMappingURL=hooks.js.map