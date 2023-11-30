import { DataSourceApi, DataSourceInstanceSettings, DataSourceRef, ScopedVars } from '@grafana/data';
import { getDataSourceSrv as getDataSourceService } from '@grafana/runtime';

export const getDatasourceSrv = (): DatasourceSrv => {
  // TODO @ts-ignore
  // @ts-ignore
  return getDataSourceService() as DatasourceSrv;
};

export type DatasourceSrv = {
  get(ref?: string | DataSourceRef | null, scopedVars?: ScopedVars): Promise<DataSourceApi>;
  getDataSourceSettingsByUid(uid: string): DataSourceInstanceSettings | undefined;
  getInstanceSettings(uid: string): DataSourceInstanceSettings | undefined;
};
