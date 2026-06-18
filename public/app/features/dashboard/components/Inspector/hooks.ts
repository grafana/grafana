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

/**
 * Returns the data source when it implements an ErrorsAndNoticesInspector and the response
 * actually has errors or result notices to show.
 */
export async function getDataSourceWithErrorsAndNoticesInspector(data?: PanelData): Promise<DataSourceApi | undefined> {
  const targets = data?.request?.targets || [];

  if (!data || !targets.length) {
    return undefined;
  }

  const hasErrors = Boolean(data.error) || Boolean(data.errors?.length);
  const hasNotices = (data.series ?? []).some((frame) => (frame.meta?.notices?.length ?? 0) > 0);

  if (!hasErrors && !hasNotices) {
    return undefined;
  }

  const dataSource = await getDataSourceSrv().get(targets[0].datasource);
  if (dataSource && dataSource.components?.ErrorsAndNoticesInspector) {
    return dataSource;
  }

  return undefined;
}
