import { act, render, screen, waitFor } from '@testing-library/react';

import { LoadingState } from '@grafana/data';

import { setupMockedDataSource } from '../../../mocks/CloudWatchDataSource';
import { RequestMock } from '../../../mocks/Request';
import { validLogsQuery } from '../../../mocks/queries';
import { CloudWatchLogsQuery } from '../../../types';

import { CloudWatchLink } from './CloudWatchLink';

describe('CloudWatchLink', () => {
  it('generates a link with log group names', async () => {
    const ds = setupMockedDataSource();

    const { rerender } = render(
      <CloudWatchLink query={validLogsQuery} datasource={ds.datasource} panelData={undefined} />
    );

    await waitFor(() => {
      expect(screen.getByText('CloudWatch Logs Insights').closest('a')).toHaveAttribute('href', '');
    });

    await act(async () => {
      rerender(
        <CloudWatchLink
          query={validLogsQuery}
          datasource={ds.datasource}
          panelData={{
            timeRange: RequestMock.range,
            request: RequestMock,
            state: LoadingState.Done,
            series: [],
          }}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('CloudWatch Logs Insights').closest('a')).toHaveAttribute(
        'href',
        "https://us-east-2.console.aws.amazon.com/cloudwatch/home?region=us-east-2#logs-insights:queryDetail=~(end~'2016-12-31T16*3a00*3a00.000Z~start~'2016-12-31T15*3a00*3a00.000Z~timeType~'ABSOLUTE~tz~'UTC~editorString~'fields*20*40timestamp*2c*20*40message*20*7c*20sort*20*40timestamp*20desc*20*7c*20limit*2025~isLiveTail~false~source~(~'group-A~'group-B))"
      );
    });
  });

  it('generates a link with log group names', async () => {
    const ds = setupMockedDataSource();
    const query: CloudWatchLogsQuery = {
      ...validLogsQuery,
      logGroupNames: undefined,
      logGroups: [
        { arn: 'arn:aws:logs:us-east-1:111111111111:log-group:/aws/lambda/test1', name: '/aws/lambda/test1' },
        { arn: 'arn:aws:logs:us-east-1:111111111111:log-group:/aws/lambda/test2', name: '/aws/lambda/test2' },
      ],
    };

    const { rerender } = render(<CloudWatchLink query={query} datasource={ds.datasource} panelData={undefined} />);

    await waitFor(() => {
      expect(screen.getByText('CloudWatch Logs Insights').closest('a')).toHaveAttribute('href', '');
    });

    await act(async () => {
      rerender(
        <CloudWatchLink
          query={query}
          datasource={ds.datasource}
          panelData={{
            timeRange: RequestMock.range,
            request: RequestMock,
            state: LoadingState.Done,
            series: [],
          }}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('CloudWatch Logs Insights').closest('a')).toHaveAttribute(
        'href',
        "https://us-east-2.console.aws.amazon.com/cloudwatch/home?region=us-east-2#logs-insights:queryDetail=~(end~'2016-12-31T16*3a00*3a00.000Z~start~'2016-12-31T15*3a00*3a00.000Z~timeType~'ABSOLUTE~tz~'UTC~editorString~'fields*20*40timestamp*2c*20*40message*20*7c*20sort*20*40timestamp*20desc*20*7c*20limit*2025~isLiveTail~false~source~(~'arn*3aaws*3alogs*3aus-east-1*3a111111111111*3alog-group*3a*2faws*2flambda*2ftest1~'arn*3aaws*3alogs*3aus-east-1*3a111111111111*3alog-group*3a*2faws*2flambda*2ftest2))"
      );
    });
  });
});
