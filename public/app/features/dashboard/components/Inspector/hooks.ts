import { type DataSourceApi, type PanelData } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

export async function getDataSourceWithInspector(data?: PanelData): Promise<DataSourceApi | undefined> {
  const targets = data?.request?.targets || [];

  if (data && data.series && targets.length) {
    for (const frame of data.series) {
      if (frame.meta && frame.meta.custom) {
        // get data source from first query
        const dataSource = await getDataSourceSrv().get(targets[0].datasource);
        if (dataSource && dataSource.components?.MetadataInspector) {
          return dataSource;
        }
      }
    }
  }

  return undefined;
}
