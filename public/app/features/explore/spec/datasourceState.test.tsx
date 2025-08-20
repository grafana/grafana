import { screen, waitFor } from '@testing-library/react';
import { Props } from 'react-virtualized-auto-sizer';

import { EventBusSrv } from '@grafana/data';

import { changeDatasource } from './helper/interactions';
import { makeLogsQueryResponse } from './helper/query';
import { setupExplore, tearDown, waitForExplore } from './helper/setup';

const testEventBus = new EventBusSrv();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: () => testEventBus,
}));

jest.mock('react-virtualized-auto-sizer', () => {
  return ({ children }: Props) =>
    children({
      height: 1,
      scaledHeight: 1,
      scaledWidth: 1,
      width: 1,
    });
});

jest.mock('app/core/core', () => ({
  contextSrv: {
    ...jest.requireActual('app/core/core').contextSrv,
    hasPermission: () => true,
    getValidIntervals: (defaultIntervals: string[]) => defaultIntervals,
  },
}));

jest.mock('../hooks/useExplorePageTitle', () => ({
  useExplorePageTitle: jest.fn(),
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
