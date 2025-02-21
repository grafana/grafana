import {
  DataQuery,
  DataSourceApi,
  DataSourceInstanceSettings,
  PluginType,
  TestDataSourceResponse,
} from '@grafana/data';

export abstract class RuntimeDataSource<TQuery extends DataQuery = DataQuery> extends DataSourceApi<TQuery> {
  public instanceSettings: DataSourceInstanceSettings;

  public constructor(pluginId: string, uid: string) {
    const instanceSettings: DataSourceInstanceSettings = {
      name: 'RuntimeDataSource-' + pluginId,
      uid: uid,
      type: pluginId,
      id: 1,
      readOnly: true,
      jsonData: {},
      access: 'direct',
      meta: {
        id: pluginId,
        name: 'RuntimeDataSource-' + pluginId,
        type: PluginType.datasource,
        info: {
          author: {
            name: '',
          },
          description: '',
          links: [],
          logos: {
            large: '',
            small: '',
          },
          screenshots: [],
          updated: '',
          version: '',
        },
        module: '',
        baseUrl: '',
      },
    };

    super(instanceSettings);
    this.instanceSettings = instanceSettings;
  }

  public testDatasource(): Promise<TestDataSourceResponse> {
    return Promise.resolve({
      status: 'success',
      message: '',
    });
  }
}
