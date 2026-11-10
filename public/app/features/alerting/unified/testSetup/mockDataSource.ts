import { type DataSourceInstanceSettings, type DataSourceJsonData, type DataSourcePluginMeta } from '@grafana/data';

let nextDataSourceId = 1;

export function mockDataSource<T extends DataSourceJsonData = DataSourceJsonData>(
  partial: Partial<DataSourceInstanceSettings<T>> = {},
  meta: Partial<DataSourcePluginMeta> = {}
): DataSourceInstanceSettings<T> {
  const id = partial.id ?? nextDataSourceId++;

  const uid = partial.uid ?? `mock-ds-${nextDataSourceId}`;

  return {
    id,
    uid,
    type: 'prometheus',
    name: `Prometheus-${id}`,
    access: 'proxy',
    url: `/api/datasources/proxy/uid/${uid}`,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Callers supply only the JSON data needed by their fixture.
    jsonData: {} as T,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Tests use partial plugin metadata rather than a complete registered plugin.
    meta: {
      info: {
        logos: {
          small: 'https://prometheus.io/assets/prometheus_logo_grey.svg',
          large: 'https://prometheus.io/assets/prometheus_logo_grey.svg',
        },
      },
      ...meta,
    } as unknown as DataSourcePluginMeta,
    readOnly: false,
    ...partial,
  };
}
