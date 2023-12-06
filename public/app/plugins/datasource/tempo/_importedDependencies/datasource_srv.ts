import { DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv as getDataSourceService, DataSourceSrv as DataSourceService } from '@grafana/runtime';

export const getDatasourceSrv = (): DatasourceSrv => {
  return getDataSourceService() as DatasourceSrv;
};

export interface DatasourceSrv extends DataSourceService {
  getDataSourceSettingsByUid(uid: string): DataSourceInstanceSettings | undefined;
}
