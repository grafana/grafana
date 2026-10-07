import { screen, waitFor } from '@testing-library/react';
import { type Props } from 'react-virtualized-auto-sizer';

import { EventBusSrv } from '@grafana/data';
import { mockBoundingClientRect } from '@grafana/test-utils';

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

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    ...jest.requireActual('app/core/services/context_srv').contextSrv,
    hasPermission: () => true,
    getValidIntervals: (defaultIntervals: string[]) => defaultIntervals,
  },
}));

jest.mock('../hooks/useExplorePageTitle', () => ({
  useExplorePageTitle: jest.fn(),
}));
beforeAll(() => {
  mockBoundingClientRect();
});

describe('Explore: handle datasource states', () => {
  afterEach(() => {
    tearDown();
  });
  it('shows warning if there are no data sources', async () => {
    setupExplore({ datasources: [] });
    await waitFor(() => screen.getByText(/Explore requires at least one data source/i));
  });

  it('handles datasource changes', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const expectedWarning = 'Virtualized log list: falling back to DOM for measurement';
    const urlParams = { left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}', refId: 'A' }]) };
    try {
      const { datasources } = setupExplore({ urlParams });
      jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
      await waitForExplore();
      await changeDatasource('elastic');

      await screen.findByText('elastic Editor input:');
      expect(datasources.elastic.query).not.toBeCalled();
      const unexpectedWarnings = warnSpy.mock.calls.filter(([message]) => message !== expectedWarning);
      expect(unexpectedWarnings).toEqual([]);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
