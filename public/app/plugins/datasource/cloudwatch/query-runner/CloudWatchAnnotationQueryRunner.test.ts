import { setupMockedAnnotationQueryRunner } from '../mocks/AnnotationQueryRunner';
import { namespaceVariable, regionVariable } from '../mocks/CloudWatchDataSource';
import { CloudWatchAnnotationQuery } from '../types';

describe('CloudWatchAnnotationQueryRunner', () => {
  const queries: CloudWatchAnnotationQuery[] = [
    {
      actionPrefix: '',
      alarmNamePrefix: '',
      datasource: { type: 'cloudwatch' },
      dimensions: { InstanceId: 'i-12345678' },
      matchExact: true,
      metricName: 'CPUUtilization',
      period: '300',
      prefixMatching: false,
      queryMode: 'Annotations',
      refId: 'Anno',
      namespace: `$${namespaceVariable.name}`,
      region: `$${regionVariable.name}`,
      statistic: 'Average',
    },
  ];

  it('should issue the correct query', async () => {
    const { runner, queryMock, request } = setupMockedAnnotationQueryRunner({
      variables: [namespaceVariable, regionVariable],
    });
    await expect(runner.handleAnnotationQuery(queries, request, queryMock)).toEmitValuesWith(() => {
      expect(queryMock.mock.calls[0][0].targets[0]).toMatchObject(
        expect.objectContaining({
          region: regionVariable.current.value,
          namespace: namespaceVariable.current.value,
          metricName: queries[0].metricName,
          dimensions: { InstanceId: ['i-12345678'] },
          statistic: queries[0].statistic,
          period: queries[0].period,
        })
      );
    });
  });
});
