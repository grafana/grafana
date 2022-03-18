import React from 'react';
import { setupExplore, waitForExplore } from './helper/setup';
import { makeLogsQueryResponse } from './helper/query';
import { DataQueryRequest, serializeStateToUrlParam } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { LokiQuery } from '../../../plugins/datasource/loki/types';

jest.mock('react-virtualized-auto-sizer', () => {
  return {
    __esModule: true,
    default(props: any) {
      return <div>{props.children({ width: 1000 })}</div>;
    },
  };
});

describe('Explore: interpolation', () => {
  // support-escalations/issues/1459
  it('Time is interpolated when explore is opened with a URL', async () => {
    const urlParams = {
      left: serializeStateToUrlParam({
        datasource: 'loki',
        queries: [{ refId: 'A', expr: '{ from="${__from}", to="${__to}" }' }],
        range: { from: '1600000000000', to: '1700000000000' },
      }),
    };
    const { datasources } = setupExplore({ urlParams });
    const fakeFetch = jest.fn();

    (datasources.loki.query as jest.Mock).mockImplementation((request: DataQueryRequest<LokiQuery>) => {
      fakeFetch(getTemplateSrv().replace(request.targets[0]!.expr));
      return makeLogsQueryResponse();
    });

    await waitForExplore();

    expect(fakeFetch).toBeCalledWith('{ from="1600000000000", to="1700000000000" }');
  });
});
