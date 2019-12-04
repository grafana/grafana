import { DataQuery } from '@grafana/data';
import { DataSourceSrv } from '@grafana/runtime';
import { DataTransformerConfig } from '@grafana/data';

export const getDefaultCondition = () => ({
  type: 'query',
  query: { params: ['A', '5m', 'now'] },
  reducer: { type: 'avg', params: [] as any[] },
  evaluator: { type: 'gt', params: [null] as any[] },
  operator: { type: 'and' },
});

export const getAlertingValidationMessage = async (
  transformations: DataTransformerConfig[],
  targets: DataQuery[],
  datasourceSrv: DataSourceSrv,
  datasourceName: string
): Promise<string> => {
  if (targets.length === 0) {
    return 'Could not find any metric queries';
  }

  if (transformations && transformations.length) {
    return 'Transformations are not supported in alert queries';
  }

  let alertingNotSupported = 0;

  for (const target of targets) {
    const dsName = target.datasource || datasourceName;
    const ds = await datasourceSrv.get(dsName);
    if (!ds.meta.alerting) {
      alertingNotSupported++;
    }
  }

  if (alertingNotSupported === targets.length) {
    return 'The datasource does not support alerting queries';
  }

  return '';
};
