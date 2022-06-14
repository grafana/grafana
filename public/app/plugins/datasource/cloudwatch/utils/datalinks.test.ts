import { DataQueryResponse, dateMath } from '@grafana/data';
import { setDataSourceSrv } from '@grafana/runtime';

import { addDataLinksToLogsResponse } from './datalinks';

describe('addDataLinksToLogsResponse', () => {
  it('should add data links to response', async () => {
    const mockResponse: DataQueryResponse = {
      data: [
        {
          fields: [
            {
              name: '@message',
              config: {},
            },
            {
              name: '@xrayTraceId',
              config: {},
            },
          ],
          refId: 'A',
        },
      ],
    };

    const mockOptions: any = {
      targets: [
        {
          refId: 'A',
          expression: 'stats count(@message) by bin(1h)',
          logGroupNames: ['fake-log-group-one', 'fake-log-group-two'],
          region: 'us-east-1',
        },
      ],
    };

    const time = {
      from: dateMath.parse('2016-12-31 15:00:00Z', false)!,
      to: dateMath.parse('2016-12-31 16:00:00Z', false)!,
    };

    setDataSourceSrv({
      async get() {
        return {
          name: 'Xray',
        };
      },
    } as any);

    await addDataLinksToLogsResponse(
      mockResponse,
      mockOptions,
      { ...time, raw: time },
      (s) => s ?? '',
      (v) => [v] ?? [],
      (r) => r,
      'xrayUid'
    );
    expect(mockResponse).toMatchObject({
      data: [
        {
          fields: [
            {
              name: '@message',
              config: {
                links: [
                  {
                    url: "https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logs-insights:queryDetail=~(end~'2016-12-31T16*3a00*3a00.000Z~start~'2016-12-31T15*3a00*3a00.000Z~timeType~'ABSOLUTE~tz~'UTC~editorString~'stats*20count*28*40message*29*20by*20bin*281h*29~isLiveTail~false~source~(~'fake-log-group-one~'fake-log-group-two))",
                    title: 'View in CloudWatch console',
                  },
                ],
              },
            },
            {
              name: '@xrayTraceId',
              config: {
                links: [
                  {
                    url: '',
                    title: 'Xray',
                    internal: {
                      query: { query: '${__value.raw}', region: 'us-east-1', queryType: 'getTrace' },
                      datasourceUid: 'xrayUid',
                      datasourceName: 'Xray',
                    },
                  },
                ],
              },
            },
          ],
          refId: 'A',
        },
      ],
    });
  });
});
