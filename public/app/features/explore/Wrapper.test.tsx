import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { serializeStateToUrlParam } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { changeDatasource } from './spec/helper/interactions';
import { makeLogsQueryResponse, makeMetricsQueryResponse } from './spec/helper/query';
import { setupExplore, tearDown, waitForExplore } from './spec/helper/setup';
import { splitOpen } from './state/main';

jest.mock('app/core/core', () => {
  return {
    contextSrv: {
      hasPermission: () => true,
      hasAccess: () => true,
    },
    appEvents: {
      subscribe: () => {},
      publish: () => {},
    },
  };
});

jest.mock('react-virtualized-auto-sizer', () => {
  return {
    __esModule: true,
    default(props: any) {
      return <div>{props.children({ width: 1000 })}</div>;
    },
  };
});

describe('Wrapper', () => {
  afterEach(() => {
    tearDown();
  });

  it('shows warning if there are no data sources', async () => {
    setupExplore({ datasources: [] });
    // Will throw if isn't found
    screen.getByText(/Explore requires at least one data source/i);
  });

  it('inits url and renders editor but does not call query on empty url', async () => {
    const { datasources } = setupExplore();
    await waitForExplore();

    // At this point url should be initialised to some defaults
    expect(locationService.getSearchObject()).toEqual({
      orgId: '1',
      left: serializeStateToUrlParam({
        datasource: 'loki',
        queries: [{ refId: 'A' }],
        range: { from: 'now-1h', to: 'now' },
      }),
    });
    expect(datasources.loki.query).not.toBeCalled();
  });

  it('runs query when url contains query and renders results', async () => {
    const urlParams = {
      left: serializeStateToUrlParam({
        datasource: 'loki',
        queries: [{ refId: 'A', expr: '{ label="value"}' }],
        range: { from: 'now-1h', to: 'now' },
      }),
    };
    const { datasources } = setupExplore({ urlParams });
    jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());

    // Make sure we render the logs panel
    await screen.findByText(/^Logs$/);

    // Make sure we render the log line
    await screen.findByText(/custom log line/i);

    // And that the editor gets the expr from the url
    await screen.findByText(`loki Editor input: { label="value"}`);

    // We did not change the url
    expect(locationService.getSearchObject()).toEqual({
      orgId: '1',
      ...urlParams,
    });

    // We called the data source query method once
    expect(datasources.loki.query).toBeCalledTimes(1);
    expect(jest.mocked(datasources.loki.query).mock.calls[0][0]).toMatchObject({
      targets: [{ expr: '{ label="value"}' }],
    });
  });

  it('handles url change and runs the new query', async () => {
    const urlParams = { left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]) };
    const { datasources } = setupExplore({ urlParams });
    jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
    // Wait for rendering the logs
    await screen.findByText(/custom log line/i);

    jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse('different log'));

    locationService.partial({
      left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="different"}' }]),
    });

    // Editor renders the new query
    await screen.findByText(`loki Editor input: { label="different"}`);
    // Renders new response
    await screen.findByText(/different log/i);
  });

  it('handles url change and runs the new query with different datasource', async () => {
    const urlParams = { left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]) };
    const { datasources } = setupExplore({ urlParams });
    jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
    // Wait for rendering the logs
    await screen.findByText(/custom log line/i);
    await screen.findByText(`loki Editor input: { label="value"}`);

    jest.mocked(datasources.elastic.query).mockReturnValueOnce(makeMetricsQueryResponse());

    locationService.partial({
      left: JSON.stringify(['now-1h', 'now', 'elastic', { expr: 'other query' }]),
    });

    // Editor renders the new query
    await screen.findByText(`elastic Editor input: other query`);
    // Renders graph
    await screen.findByText(/Graph/i);
  });

  it('handles changing the datasource manually', async () => {
    const urlParams = { left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}', refId: 'A' }]) };
    const { datasources } = setupExplore({ urlParams });
    jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
    await waitForExplore();
    await changeDatasource('elastic');

    await screen.findByText('elastic Editor input:');
    expect(datasources.elastic.query).not.toBeCalled();
    expect(locationService.getSearchObject()).toEqual({
      orgId: '1',
      left: serializeStateToUrlParam({
        datasource: 'elastic',
        queries: [{ refId: 'A' }],
        range: { from: 'now-1h', to: 'now' },
      }),
    });
  });

  it('opens the split pane when split button is clicked', async () => {
    setupExplore();
    // Wait for rendering the editor
    const splitButton = await screen.findByText(/split/i);
    fireEvent.click(splitButton);
    await waitFor(() => {
      const editors = screen.getAllByText('loki Editor input:');
      expect(editors.length).toBe(2);
    });
  });

  it('inits with two panes if specified in url', async () => {
    const urlParams = {
      left: serializeStateToUrlParam({
        datasource: 'loki',
        queries: [{ refId: 'A', expr: '{ label="value"}' }],
        range: { from: 'now-1h', to: 'now' },
      }),
      right: serializeStateToUrlParam({
        datasource: 'elastic',
        queries: [{ refId: 'A', expr: 'error' }],
        range: { from: 'now-1h', to: 'now' },
      }),
    };

    const { datasources } = setupExplore({ urlParams });
    jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
    jest.mocked(datasources.elastic.query).mockReturnValueOnce(makeLogsQueryResponse());

    // Make sure we render the logs panel
    await waitFor(() => {
      const logsPanels = screen.getAllByText(/^Logs$/);
      expect(logsPanels.length).toBe(2);
    });

    // Make sure we render the log line
    const logsLines = await screen.findAllByText(/custom log line/i);
    expect(logsLines.length).toBe(2);

    // And that the editor gets the expr from the url
    await screen.findByText(`loki Editor input: { label="value"}`);
    await screen.findByText(`elastic Editor input: error`);

    // We did not change the url
    expect(locationService.getSearchObject()).toEqual({
      orgId: '1',
      ...urlParams,
    });

    // We called the data source query method once
    expect(datasources.loki.query).toBeCalledTimes(1);
    expect(jest.mocked(datasources.loki.query).mock.calls[0][0]).toMatchObject({
      targets: [{ expr: '{ label="value"}' }],
    });

    expect(datasources.elastic.query).toBeCalledTimes(1);
    expect(jest.mocked(datasources.elastic.query).mock.calls[0][0]).toMatchObject({
      targets: [{ expr: 'error' }],
    });
  });

  it('can close a panel from a split', async () => {
    const urlParams = {
      left: JSON.stringify(['now-1h', 'now', 'loki', { refId: 'A' }]),
      right: JSON.stringify(['now-1h', 'now', 'elastic', { refId: 'A' }]),
    };
    setupExplore({ urlParams });
    const closeButtons = await screen.findAllByLabelText(/Close split pane/i);
    await userEvent.click(closeButtons[1]);

    await waitFor(() => {
      const logsPanels = screen.queryAllByLabelText(/Close split pane/i);
      expect(logsPanels.length).toBe(0);
    });
  });

  it('handles url change to split view', async () => {
    const urlParams = {
      left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]),
    };
    const { datasources } = setupExplore({ urlParams });
    jest.mocked(datasources.loki.query).mockReturnValue(makeLogsQueryResponse());
    jest.mocked(datasources.elastic.query).mockReturnValue(makeLogsQueryResponse());

    locationService.partial({
      left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]),
      right: JSON.stringify(['now-1h', 'now', 'elastic', { expr: 'error' }]),
    });

    // Editor renders the new query
    await screen.findByText(`loki Editor input: { label="value"}`);
    await screen.findByText(`elastic Editor input: error`);
  });

  it('handles opening split with split open func', async () => {
    const urlParams = {
      left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]),
    };
    const { datasources, store } = setupExplore({ urlParams });
    jest.mocked(datasources.loki.query).mockReturnValue(makeLogsQueryResponse());
    jest.mocked(datasources.elastic.query).mockReturnValue(makeLogsQueryResponse());

    // This is mainly to wait for render so that the left pane state is initialized as that is needed for splitOpen
    // to work
    await screen.findByText(`loki Editor input: { label="value"}`);

    store.dispatch(splitOpen<any>({ datasourceUid: 'elastic', query: { expr: 'error' } }) as any);

    // Editor renders the new query
    await screen.findByText(`elastic Editor input: error`);
    await screen.findByText(`loki Editor input: { label="value"}`);
  });

  it('changes the document title of the explore page to include the datasource in use', async () => {
    const urlParams = {
      left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]),
    };
    const { datasources } = setupExplore({ urlParams });
    jest.mocked(datasources.loki.query).mockReturnValue(makeLogsQueryResponse());
    // This is mainly to wait for render so that the left pane state is initialized as that is needed for the title
    // to include the datasource
    await screen.findByText(`loki Editor input: { label="value"}`);

    await waitFor(() => expect(document.title).toEqual('Explore - loki - Grafana'));
  });
  it('changes the document title to include the two datasources in use in split view mode', async () => {
    const urlParams = {
      left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]),
    };
    const { datasources, store } = setupExplore({ urlParams });
    jest.mocked(datasources.loki.query).mockReturnValue(makeLogsQueryResponse());
    jest.mocked(datasources.elastic.query).mockReturnValue(makeLogsQueryResponse());

    // This is mainly to wait for render so that the left pane state is initialized as that is needed for splitOpen
    // to work
    await screen.findByText(`loki Editor input: { label="value"}`);

    store.dispatch(splitOpen<any>({ datasourceUid: 'elastic', query: { expr: 'error' } }) as any);
    await waitFor(() => expect(document.title).toEqual('Explore - loki | elastic - Grafana'));
  });

  it('removes `from` and `to` parameters from url when first mounted', async () => {
    setupExplore({ searchParams: 'from=1&to=2&orgId=1' });

    expect(locationService.getSearchObject()).toEqual(expect.not.objectContaining({ from: '1', to: '2' }));
    expect(locationService.getSearchObject()).toEqual(expect.objectContaining({ orgId: '1' }));
  });
});
