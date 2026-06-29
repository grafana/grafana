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
 * Whether the response has any errors or result notices worth showing in the errors and
 * notices inspector tab. The standard inspector can render these for any data source.
 */
export function hasErrorsOrNotices(data?: PanelData): boolean {
  if (!data) {
    return false;
  }

  const hasErrors = Boolean(data.error) || Boolean(data.errors?.length);
  const hasNotices = (data.series ?? []).some((frame) => (frame.meta?.notices?.length ?? 0) > 0);

  return hasErrors || hasNotices;
}

/**
 * Returns the data source when it provides a custom ErrorsAndNoticesInspector. This is only
 * resolved for non-mixed panels: with mixed data sources we can't pick a single custom
 * inspector, so the standard inspector is used instead.
 */
export async function getDataSourceWithErrorsAndNoticesInspector(data?: PanelData): Promise<DataSourceApi | undefined> {
  const targets = data?.request?.targets || [];

  if (!targets.length) {
    return undefined;
  }

  const uniqueDataSourceUids = new Set(targets.map((target) => target.datasource?.uid));
  if (uniqueDataSourceUids.size > 1) {
    return undefined;
  }

  const dataSource = await getDataSourceSrv().get(targets[0].datasource);
  if (dataSource && dataSource.components?.ErrorsAndNoticesInspector) {
    return dataSource;
  }

  return undefined;
}
