import { useEffect } from 'react';

import { DataSourcePluginMeta, DataSourceSettings } from '@grafana/data';
import { t } from '@grafana/i18n';
import { cleanUpAction } from 'app/core/actions/cleanUp';
import appEvents from 'app/core/app_events';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types/accessControl';
import { ShowConfirmModalEvent } from 'app/types/events';
import { useDispatch, useSelector } from 'app/types/store';

import { ROUTES } from '../../connections/constants';
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

  return () => dispatch(testDataSource(uid, ROUTES.DataSourcesEdit));
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

  return (plugin: DataSourcePluginMeta) => {
    dispatch(addDataSource(plugin, ROUTES.DataSourcesEdit));
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
        title: t('datasources.use-delete-loaded-data-source.title.delete', 'Delete'),
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
