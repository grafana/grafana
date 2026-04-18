import { type Observable } from 'rxjs';

import {
  type DataQueryRequest,
  type DataQueryResponse,
  type DataQueryResponseData,
  type TestDataSourceResponse,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import {
  PanelBuilders,
  RuntimeDataSource,
  SceneFlexItem,
  SceneQueryRunner,
  type SceneTimeRange,
  sceneUtils,
} from '@grafana/scenes';
import { type DataQuery, type DataSourceRef } from '@grafana/schema';
import { getTimeRange } from 'app/features/dashboard/utils/timeRange';

import { PANEL_STYLES } from '../../home/Insights';

export const getLabelsInfo = (from: number, to: number): Observable<DataQueryResponseData> => {
  return getBackendSrv().fetch({
    url: `/api/v1/rules/history`,
    params: { from, to, limit: 100 },
    method: 'GET',
  });
};

class LokiAPIDatasource extends RuntimeDataSource {
  private timeRange: SceneTimeRange;

  constructor(pluginId: string, uid: string, timeRange: SceneTimeRange) {
    super(pluginId, uid);
    this.timeRange = timeRange;
  }

  query(request: DataQueryRequest<DataQuery>): Promise<DataQueryResponse> | Observable<DataQueryResponse> {
    const timeRange = getTimeRange({ from: this.timeRange.state.from, to: this.timeRange.state.to });
    return getLabelsInfo(timeRange.from.unix(), timeRange.to.unix());
  }

  testDatasource(): Promise<TestDataSourceResponse> {
    return Promise.resolve({
      status: 'success',
      message: t('alerting.loki-apidatasource.message.data-source-is-working', 'Data source is working'),
      title: t('alerting.loki-apidatasource.title.success', 'Success'),
    });
  }
}

export function getMostFiredLabelsScene(timeRange: SceneTimeRange, datasource: DataSourceRef, panelTitle: string) {
  sceneUtils.registerRuntimeDataSource({ dataSource: new LokiAPIDatasource('loki-api-ds', 'LOKI-API', timeRange) });

  const query = new SceneQueryRunner({
    datasource: { uid: 'LOKI-API', type: 'loki-api-ds' },
    queries: [{ refId: 'A', expr: 'vector(1)' }],
    $timeRange: timeRange,
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.table().setTitle(panelTitle).setDescription(panelTitle).setData(query).build(),
  });
}
