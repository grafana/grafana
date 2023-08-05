import { useContext, useEffect } from 'react';

import { DataSourcePluginMeta, DataSourceSettings, NavModel, NavModelItem } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { cleanUpAction } from 'app/core/actions/cleanUp';
import appEvents from 'app/core/app_events';
import { contextSrv } from 'app/core/core';
import { getNavModel } from 'app/core/selectors/navModel';
import { useGetSingle } from 'app/features/plugins/admin/state/hooks';
import { AccessControlAction, useDispatch, useSelector } from 'app/types';
import { ShowConfirmModalEvent } from 'app/types/events';

import { DataSourceRights } from '../types';
import { constructDataSourceExploreUrl } from '../utils';

import {
  initDataSourceSettings,
  testDataSource,
  loadDataSource,
  loadDataSources,
  loadDataSourcePlugins,
  addDataSource,
  updateDataSource,
  deleteLoadedDataSource,
} from './actions';
import { DataSourcesRoutesContext } from './contexts';
import { getDataSourceLoadingNav, buildNavModel, getDataSourceNav } from './navModel';
import { initialDataSourceSettingsState } from './reducers';
import { getDataSource, getDataSourceMeta } from './selectors';

export const useInitDataSourceSettings = (uid: string) => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(initDataSourceSettings(uid));

    return function cleanUp() {
      dispatch(
        cleanUpAction({
          cleanupAction: (state) => (state.dataSourceSettings = initialDataSourceSettingsState),
        })
      );
    };
  }, [uid, dispatch]);
};

export const useTestDataSource = (uid: string) => {
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

export const useLoadDataSource = (uid: string) => {
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

  return (plugin: DataSourcePluginMeta) => {
    dispatch(addDataSource(plugin, dataSourcesRoutes.Edit));
  };
};

export const useUpdateDatasource = () => {
  const dispatch = useDispatch();

  return async (dataSource: DataSourceSettings) => dispatch(updateDataSource(dataSource));
};

export const useDeleteLoadedDataSource = () => {
  const dispatch = useDispatch();
  const { name } = useSelector((state) => state.dataSources.dataSource);

  return () => {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: 'Delete',
        text: `Are you sure you want to delete the "${name}" data source?`,
        yesText: 'Delete',
        icon: 'trash-alt',
        onConfirm: () => dispatch(deleteLoadedDataSource()),
      })
    );
  };
};

export const useDataSource = (uid: string) => {
  return useSelector((state) => getDataSource(state.dataSources, uid));
};

export const useDataSourceExploreUrl = (uid: string) => {
  const dataSource = useDataSource(uid);
  return constructDataSourceExploreUrl(dataSource);
};

export const useDataSourceMeta = (pluginType: string): DataSourcePluginMeta => {
  return useSelector((state) => getDataSourceMeta(state.dataSources, pluginType));
};

export const useDataSourceSettings = () => {
  return useSelector((state) => state.dataSourceSettings);
};

export const useDataSourceSettingsNav = (dataSourceId: string, pageId: string | null) => {
  const { plugin, loadError, loading } = useDataSourceSettings();
  const dataSource = useDataSource(dataSourceId);
  const dsi = getDataSourceSrv()?.getInstanceSettings(dataSourceId);
  const hasAlertingEnabled = Boolean(dsi?.meta?.alerting ?? false);
  const isAlertManagerDatasource = dsi?.type === 'alertmanager';
  const alertingSupported = hasAlertingEnabled || isAlertManagerDatasource;

  const datasourcePlugin = useGetSingle(dataSource.type);
  const navIndex = useSelector((state) => state.navIndex);
  const navIndexId = pageId ? `datasource-${pageId}-${dataSourceId}` : `datasource-settings-${dataSourceId}`;
  let pageNav: NavModel = {
    node: {
      text: 'Data Source Nav Node',
    },
    main: {
      text: 'Data Source Nav Node',
    },
  };

  if (loadError) {
    const node: NavModelItem = {
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
    pageNav = getNavModel(
      navIndex,
      navIndexId,
      getDataSourceNav(buildNavModel(dataSource, plugin), pageId || 'settings')
    );
  }

  return {
    node: pageNav.node,
    main: {
      ...pageNav.main,
      text: dataSource.name,
      dataSourcePluginName: datasourcePlugin?.name || plugin?.meta.name || '',
      active: true,
    },
    dataSourceHeader: {
      alertingSupported,
    },
  };
};

export const useDataSourceRights = (uid: string): DataSourceRights => {
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
