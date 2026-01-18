import { lastValueFrom } from 'rxjs';

import { DataSourceSettings } from '@grafana/data';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { accessControlQueryParam } from 'app/core/utils/accessControl';

export const getDataSources = async (): Promise<DataSourceSettings[]> => {
  return await getBackendSrv().get('/api/datasources');
};

export const getDataSourceByUid = async (uid: string) => {
  const response = await lastValueFrom(
    getBackendSrv().fetch<DataSourceSettings>({
      method: 'GET',
      url: `/api/datasources/uid/${uid}`,
      params: accessControlQueryParam(),
      showErrorAlert: false,
    })
  );

  if (response.ok) {
    return response.data;
  }

  throw Error(`Could not find data source by UID: "${uid}"`);
};

/**
 * @deprecated Use `getDataSourceByUid` instead.
 */
export const getDataSourceByIdOrUid = async (idOrUid: string) => {
  return getDataSourceByUid(idOrUid);
};

export const createDataSource = (dataSource: Partial<DataSourceSettings>) =>
  getBackendSrv().post('/api/datasources', dataSource);

export const getDataSourcePlugins = () => getBackendSrv().get('/api/plugins', { enabled: 1, type: 'datasource' });

export const updateDataSource = (dataSource: DataSourceSettings) => {
  // we're setting showErrorAlert and showSuccessAlert to false to suppress the popover notifications. Request result will now be
  // handled by the data source config page
  return getBackendSrv().put(`/api/datasources/uid/${dataSource.uid}`, dataSource, {
    showErrorAlert: false,
    showSuccessAlert: false,
    validatePath: true,
  });
};

export const deleteDataSource = (uid: string) => getBackendSrv().delete(`/api/datasources/uid/${uid}`);
