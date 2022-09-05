import { useContext, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { DataSourcePluginMeta, DataSourceSettings, NavModelItem, urlUtil } from '@grafana/data';
import { cleanUpAction } from 'app/core/actions/cleanUp';
import appEvents from 'app/core/app_events';
import { contextSrv } from 'app/core/core';
import { getNavModel } from 'app/core/selectors/navModel';
import { AccessControlAction, StoreState } from 'app/types';
import { ShowConfirmModalEvent } from 'app/types/events';

import { DataSourceRights } from '../types';

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
import { getDataSource, getDataSourceMeta } from './selectors';

export const useInitDataSourceSettings = (uid: string) => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(initDataSourceSettings(uid));

    return function cleanUp() {
      dispatch(
        cleanUpAction({
          stateSelector: (state) => state.dataSourceSettings,
        })
      );
    };
  }, [uid, dispatch]);
};

export const useTestDataSource = (uid: string) => {
  const dispatch = useDispatch();

  return () => dispatch(testDataSource(uid));
};

export const useLoadDataSources = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(loadDataSources());
  }, [dispatch]);
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

  return (dataSource: DataSourceSettings) => dispatch(updateDataSource(dataSource));
};

export const useDeleteLoadedDataSource = () => {
  const dispatch = useDispatch();
  const { name } = useSelector((state: StoreState) => state.dataSources.dataSource);

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
  return useSelector((state: StoreState) => getDataSource(state.dataSources, uid));
};

export const useDataSourceExploreUrl = (uid: string) => {
  const dataSource = useDataSource(uid);
  const exploreState = JSON.stringify({ datasource: dataSource.name, context: 'explore' });
  const exploreUrl = urlUtil.renderUrl('/explore', { left: exploreState });

  return exploreUrl;
};

export const useDataSourceMeta = (pluginType: string): DataSourcePluginMeta => {
  return useSelector((state: StoreState) => getDataSourceMeta(state.dataSources, pluginType));
};

export const useDataSourceSettings = () => {
  return useSelector((state: StoreState) => state.dataSourceSettings);
};

export const useDataSourceSettingsNav = (dataSourceId: string, pageId: string | null) => {
  const dataSource = useDataSource(dataSourceId);
  const { plugin, loadError, loading } = useDataSourceSettings();
  const navIndex = useSelector((state: StoreState) => state.navIndex);
  const navIndexId = pageId ? `datasource-${pageId}-${dataSourceId}` : `datasource-settings-${dataSourceId}`;

  if (loadError) {
    const node: NavModelItem = {
      text: loadError,
      subTitle: 'Data Source Error',
      icon: 'exclamation-triangle',
    };

    return {
      node: node,
      main: node,
    };
  }

  if (loading || !plugin) {
    return getNavModel(navIndex, navIndexId, getDataSourceLoadingNav('settings'));
  }

  return getNavModel(navIndex, navIndexId, getDataSourceNav(buildNavModel(dataSource, plugin), pageId || 'settings'));
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
