import { setupMockedAnnotationQueryRunner } from '../__mocks__/AnnotationQueryRunner';
import { namespaceVariable, regionVariable } from '../__mocks__/CloudWatchDataSource';
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
    const { runner, fetchMock, request } = setupMockedAnnotationQueryRunner({
      variables: [namespaceVariable, regionVariable],
    });
    await expect(runner.handleAnnotationQuery(queries, request)).toEmitValuesWith(() => {
      expect(fetchMock.mock.calls[0][0].data.queries[0]).toMatchObject(
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
