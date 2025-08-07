import {
  DataSourcePluginMeta,
  DataSourceSettings,
  locationUtil,
  TestDataSourceResponse,
  DataSourceTestSucceeded,
  DataSourceTestFailed,
  DataSourceApi,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  config,
  DataSourceSrv,
  DataSourceWithBackend,
  HealthCheckError,
  HealthCheckResultDetails,
  isFetchError,
  locationService,
} from '@grafana/runtime';
import { updateNavIndex } from 'app/core/actions';
import { appEvents, contextSrv } from 'app/core/core';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { DatasourceAPIVersions } from 'app/features/apiserver/client';
import { ROUTES as CONNECTIONS_ROUTES } from 'app/features/connections/constants';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { importDataSourcePlugin } from 'app/features/plugins/pluginLoader';
import { getPluginSettings } from 'app/features/plugins/pluginSettings';
import { AccessControlAction } from 'app/types/accessControl';
import { DataSourcePluginCategory } from 'app/types/datasources';
import { ThunkDispatch, ThunkResult } from 'app/types/store';

import * as api from '../api';
import { DATASOURCES_ROUTES } from '../constants';
import { trackDataSourceCreated, trackDataSourceTested } from '../tracking';

import { buildCategories } from './buildCategories';
import { buildNavModel } from './navModel';
import {
  dataSourceLoaded,
  dataSourceMetaLoaded,
  dataSourcePluginsLoad,
  dataSourcePluginsLoaded,
  dataSourcesLoad,
  dataSourcesLoaded,
  initDataSourceSettingsFailed,
  initDataSourceSettingsSucceeded,
  testDataSourceFailed,
  testDataSourceStarting,
  testDataSourceSucceeded,
} from './reducers';
import { getDataSource, getDataSourceMeta } from './selectors';

export interface DataSourceTypesLoadedPayload {
  plugins: DataSourcePluginMeta[];
  categories: DataSourcePluginCategory[];
}

export interface InitDataSourceSettingDependencies {
  loadDataSource: typeof loadDataSource;
  loadDataSourceMeta: typeof loadDataSourceMeta;
  getDataSource: typeof getDataSource;
  getDataSourceMeta: typeof getDataSourceMeta;
  importDataSourcePlugin: typeof importDataSourcePlugin;
}

export interface TestDataSourceDependencies {
  getDatasourceSrv: () => Pick<DataSourceSrv, 'get'>;
  getBackendSrv: typeof getBackendSrv;
}

type parseDataSourceSaveResponse = {
  message?: string | undefined;
  status?: string;
  details?: HealthCheckResultDetails | { message?: string; verboseMessage?: string };
};

const parseHealthCheckError = (errorResponse: any): parseDataSourceSaveResponse => {
  let message: string | undefined;
  let details: HealthCheckResultDetails;

  if (errorResponse.error && errorResponse.error instanceof HealthCheckError) {
    message = errorResponse.error.message;
    details = errorResponse.error.details;
  } else if (isFetchError(errorResponse)) {
    message = errorResponse.data.message ?? `HTTP error ${errorResponse.statusText}`;
  } else if (errorResponse instanceof Error) {
    message = errorResponse.message;
  }

  return { message, details };
};

const parseHealthCheckSuccess = (response: TestDataSourceResponse): parseDataSourceSaveResponse => {
  const { details, message, status } = response;

  return { status, message, details };
};

export const initDataSourceSettings = (
  uid: string,
  dependencies: InitDataSourceSettingDependencies = {
    loadDataSource,
    loadDataSourceMeta,
    getDataSource,
    getDataSourceMeta,
    importDataSourcePlugin,
  }
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    if (!uid) {
      dispatch(initDataSourceSettingsFailed(new Error('Invalid UID')));
      return;
    }

    try {
      const loadedDataSource = await dispatch(dependencies.loadDataSource(uid));
      await dispatch(dependencies.loadDataSourceMeta(loadedDataSource));

      const dataSource = dependencies.getDataSource(getState().dataSources, uid);
      const dataSourceMeta = dependencies.getDataSourceMeta(getState().dataSources, dataSource!.type);
      const importedPlugin = await dependencies.importDataSourcePlugin(dataSourceMeta);

      dispatch(initDataSourceSettingsSucceeded(importedPlugin));
    } catch (err) {
      if (err instanceof Error) {
        dispatch(initDataSourceSettingsFailed(err));
      }
    }
  };
};

const getPluginVersion = (dsApi: DataSourceApi) => {
  const isCorePlugin = (dsApi?.meta?.module || '').startsWith('core');
  return isCorePlugin ? config?.buildInfo?.version : dsApi?.meta?.info?.version;
};

export const testDataSource = (
  dataSourceName: string,
  editRoute = DATASOURCES_ROUTES.Edit,
  dependencies: TestDataSourceDependencies = {
    getDatasourceSrv,
    getBackendSrv,
  }
): ThunkResult<void> => {
  return async (dispatch: ThunkDispatch, getState) => {
    const dsApi = await dependencies.getDatasourceSrv().get(dataSourceName);
    const editLink = editRoute.replace(/:uid/gi, dataSourceName);

    if (!dsApi.testDatasource) {
      return;
    }

    dispatch(testDataSourceStarting());

    dependencies.getBackendSrv().withNoBackendCache(async () => {
      try {
        const result = await dsApi.testDatasource();

        const parsedResult = parseHealthCheckSuccess({ ...result, details: { ...result.details } });
        dispatch(testDataSourceSucceeded(parsedResult));

        trackDataSourceTested({
          grafana_version: config.buildInfo.version,
          plugin_id: dsApi.type,
          plugin_version: getPluginVersion(dsApi),
          datasource_uid: dsApi.uid,
          success: true,
          path: editLink,
        });
        appEvents.publish(new DataSourceTestSucceeded());
      } catch (err) {
        const formattedError = parseHealthCheckError(err);

        dispatch(testDataSourceFailed({ ...formattedError }));
        trackDataSourceTested({
          grafana_version: config.buildInfo.version,
          plugin_id: dsApi.type,
          plugin_version: getPluginVersion(dsApi),
          datasource_uid: dsApi.uid,
          success: false,
          path: editLink,
        });
        appEvents.publish(new DataSourceTestFailed());
      }
    });
  };
};

export function loadDataSources(): ThunkResult<Promise<void>> {
  return async (dispatch) => {
    if (!contextSrv.hasPermission(AccessControlAction.DataSourcesRead)) {
      return;
    }
    dispatch(dataSourcesLoad());
    const response = await api.getDataSources();
    dispatch(dataSourcesLoaded(response));
  };
}

export function loadDataSource(uid: string): ThunkResult<Promise<DataSourceSettings>> {
  return async (dispatch) => {
    let dataSource = await api.getDataSourceByIdOrUid(uid);

    // Reload route to use UID instead
    // -------------------------------
    // In case we were trying to fetch and reference a data-source with an old numeric ID
    // (which can happen by referencing it with a "old" URL), we would like to automatically redirect
    // to the new URL format using the UID.
    // [Please revalidate the following]: Unfortunately we can update the location using react router, but need to fully reload the
    // route as the nav model page index is not matching with the url in that case.
    // And react router has no way to unmount remount a route.
    if (uid !== dataSource.uid) {
      window.location.href = locationUtil.assureBaseUrl(`/datasources/edit/${dataSource.uid}`);

      // Avoid a flashing error while the reload happens
      dataSource = {} as DataSourceSettings;
    }

    dispatch(dataSourceLoaded(dataSource));

    return dataSource;
  };
}

export function loadDataSourceMeta(dataSource: DataSourceSettings): ThunkResult<void> {
  return async (dispatch) => {
    const pluginInfo: DataSourcePluginMeta = await getPluginSettings(dataSource.type);
    const plugin = await importDataSourcePlugin(pluginInfo);
    const isBackend = plugin.DataSourceClass.prototype instanceof DataSourceWithBackend;
    const meta = {
      ...pluginInfo,
      isBackend: pluginInfo.backend || isBackend,
    };

    dispatch(dataSourceMetaLoaded(meta));

    plugin.meta = meta;
    dispatch(updateNavIndex(buildNavModel(dataSource, plugin)));
  };
}

export function addDataSource(
  plugin: DataSourcePluginMeta,
  editRoute = DATASOURCES_ROUTES.Edit
): ThunkResult<Promise<void>> {
  return async () => {
    const newInstance = {
      type: plugin.id,
      access: 'proxy',
    };

    const result = await api.createDataSource(newInstance);
    const editLink = editRoute.replace(/:uid/gi, result.datasource.uid);

    await getDatasourceSrv().reload();
    await contextSrv.fetchUserPermissions();

    trackDataSourceCreated({
      grafana_version: config.buildInfo.version,
      plugin_id: plugin.id,
      datasource_uid: result.datasource.uid,
      plugin_version: result.meta?.info?.version,
      path: window.location.pathname,
    });

    locationService.push(editLink);
  };
}

export function loadDataSourcePlugins(): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(dataSourcePluginsLoad());
    const plugins = await api.getDataSourcePlugins();
    const categories = buildCategories(plugins);
    dispatch(dataSourcePluginsLoaded({ plugins, categories }));
  };
}

const dsApiVersions = new DatasourceAPIVersions();

export function updateDataSource(dataSource: DataSourceSettings) {
  return async (
    dispatch: (
      dataSourceSettings: ThunkResult<Promise<DataSourceSettings>> | { payload: unknown; type: string }
    ) => DataSourceSettings
  ) => {
    try {
      if (config.featureToggles.grafanaAPIServerWithExperimentalAPIs) {
        dataSource.apiVersion = await dsApiVersions.get(dataSource.type);
      }
      await api.updateDataSource(dataSource);
    } catch (err) {
      const formattedError = parseHealthCheckError(err);

      dispatch(testDataSourceFailed(formattedError));
      const errorInfo = isFetchError(err)
        ? err.data
        : {
            message: t(
              'datasources.update-data-source.error-info.message.an-unexpected-error-occurred',
              'An unexpected error occurred.'
            ),
            traceID: '',
          };
      return Promise.reject(errorInfo);
    }

    await getDatasourceSrv().reload();

    return dispatch(loadDataSource(dataSource.uid));
  };
}

export function deleteLoadedDataSource(): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const { uid } = getStore().dataSources.dataSource;

    try {
      await api.deleteDataSource(uid);
      await getDatasourceSrv().reload();

      const datasourcesUrl = CONNECTIONS_ROUTES.DataSources;

      locationService.push(datasourcesUrl);
    } catch (err) {
      const formattedError = parseHealthCheckError(err);
      dispatch(testDataSourceFailed(formattedError));
    }
  };
}
