import { screen, waitFor } from '@testing-library/react';

import { EventBusSrv } from '@grafana/data';

import { changeDatasource } from './helper/interactions';
import { makeLogsQueryResponse } from './helper/query';
import { setupExplore, tearDown, waitForExplore } from './helper/setup';

jest.mock('../../correlations/utils', () => {
  return {
    getCorrelationsBySourceUIDs: jest.fn().mockReturnValue({ correlations: [] }),
  };
});

const testEventBus = new EventBusSrv();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: () => testEventBus,
}));

jest.mock('app/core/core', () => ({
  contextSrv: {
    hasAccess: () => true,
    hasPermission: () => true,
    getValidIntervals: (defaultIntervals: string[]) => defaultIntervals,
  },
}));

describe('Explore: handle datasource states', () => {
  afterEach(() => {
    tearDown();
  });
  it('shows warning if there are no data sources', async () => {
    setupExplore({ datasources: [] });
    await waitFor(() => screen.getByText(/Explore requires at least one data source/i));
  });

  it('handles datasource changes', async () => {
    const urlParams = { left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}', refId: 'A' }]) };
    const { datasources } = setupExplore({ urlParams });
    jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
    await waitForExplore();
    await changeDatasource('elastic');

    await screen.findByText('elastic Editor input:');
    expect(datasources.elastic.query).not.toBeCalled();
  });
});
