import { Props } from 'react-virtualized-auto-sizer';

import { DataQueryRequest, EventBusSrv, serializeStateToUrlParam } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { LokiQuery } from '../../../plugins/datasource/loki/types';

import { makeLogsQueryResponse } from './helper/query';
import { setupExplore, tearDown, waitForExplore } from './helper/setup';

const testEventBus = new EventBusSrv();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: () => testEventBus,
}));

jest.mock('app/core/core', () => ({
  contextSrv: {
    ...jest.requireActual('app/core/core').contextSrv,
    hasPermission: () => true,
    getValidIntervals: (defaultIntervals: string[]) => defaultIntervals,
  },
}));

jest.mock('react-virtualized-auto-sizer', () => {
  return {
    __esModule: true,
    default(props: Props) {
      return <div>{props.children({ height: 1, scaledHeight: 1, scaledWidth: 1000, width: 1000 })}</div>;
    },
  };
});

jest.mock('../hooks/useExplorePageTitle', () => ({
  useExplorePageTitle: jest.fn(),
}));

describe('Explore: interpolation', () => {
  afterEach(() => {
    tearDown();
  });

  // support-escalations/issues/1459
  it('Time is interpolated when explore is opened with a URL', async () => {
    const urlParams = {
      left: serializeStateToUrlParam({
        datasource: 'loki',
        queries: [{ refId: 'A', expr: '{ job="a", from="${__from}", to="${__to}" }' }],
        range: { from: '1600000000000', to: '1700000000000' },
      }),
      right: serializeStateToUrlParam({
        datasource: 'loki',
        queries: [{ refId: 'b', expr: '{ job="b", from="${__from}", to="${__to}" }' }],
        range: { from: '1800000000000', to: '1900000000000' },
      }),
    };
    const { datasources } = setupExplore({ urlParams });
    const fakeFetch = jest.fn();

    (datasources.loki.query as jest.Mock).mockImplementation((request: DataQueryRequest<LokiQuery>) => {
      fakeFetch(getTemplateSrv().replace(request.targets[0]!.expr));
      return makeLogsQueryResponse();
    });

    await waitForExplore();

    expect(fakeFetch).toBeCalledTimes(2);
    expect(fakeFetch).toHaveBeenCalledWith('{ job="a", from="1600000000000", to="1700000000000" }');
    expect(fakeFetch).toHaveBeenCalledWith('{ job="b", from="1800000000000", to="1900000000000" }');
  });
});
