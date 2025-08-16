import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { EventBusSrv, serializeStateToUrlParam } from '@grafana/data';

import * as mainState from '../state/main';

import { makeLogsQueryResponse } from './helper/query';
import { setupExplore, tearDown, waitForExplore } from './helper/setup';

const testEventBus = new EventBusSrv();

jest.mock('app/core/core', () => {
  return {
    contextSrv: {
      ...jest.requireActual('app/core/core').contextSrv,
      hasPermission: () => true,
      getValidIntervals: (defaultIntervals: string[]) => defaultIntervals,
    },
  };
});

jest.mock('react-virtualized-auto-sizer', () => {
  return {
    __esModule: true,
    default(props: ComponentProps<typeof AutoSizer>) {
      return (
        <div>
          {props.children({
            width: 1000,
            scaledWidth: 1000,
            scaledHeight: 1000,
            height: 1000,
          })}
        </div>
      );
    },
  };
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: () => testEventBus,
}));

jest.mock('../hooks/useExplorePageTitle', () => ({
  useExplorePageTitle: jest.fn(),
}));

describe('Handles open/close splits and related events in UI and URL', () => {
  afterEach(() => {
    tearDown();
  });

  it('opens the split pane when split button is clicked', async () => {
    const { location } = setupExplore();

    await waitFor(() => {
      const editors = screen.getAllByText('loki Editor input:');
      expect(editors.length).toBe(1);

      // initializing explore replaces the first history entry
      expect(location.getHistory().length).toBe(1);
      expect(location.getHistory().action).toBe('REPLACE');
    });

    // Wait for rendering the editor
    const splitButton = await screen.findByRole('button', { name: /split/i });
    await userEvent.click(splitButton);
    await waitFor(() => {
      const editors = screen.getAllByText('loki Editor input:');
      expect(editors.length).toBe(2);
      // a new entry is pushed to the history
      expect(location.getHistory().length).toBe(2);
    });

    act(() => {
      location.getHistory().goBack();
    });

    await waitFor(() => {
      const editors = screen.getAllByText('loki Editor input:');
      expect(editors.length).toBe(1);
      // going back pops the history
      expect(location.getHistory().action).toBe('POP');
      expect(location.getHistory().length).toBe(2);
    });

    act(() => {
      location.getHistory().goForward();
    });

    await waitFor(() => {
      const editors = screen.getAllByText('loki Editor input:');
      expect(editors.length).toBe(2);
      // going forward pops the history
      expect(location.getHistory().action).toBe('POP');
      expect(location.getHistory().length).toBe(2);
    });
  });

  it('inits with two panes if specified in url', async () => {
    const urlParams = {
      left: serializeStateToUrlParam({
        datasource: 'loki-uid',
        queries: [{ refId: 'A', expr: '{ label="value"}', datasource: { type: 'logs', uid: 'loki-uid' } }],
        range: { from: 'now-1h', to: 'now' },
      }),
      right: serializeStateToUrlParam({
        datasource: 'elastic-uid',
        queries: [{ refId: 'A', expr: 'error', datasource: { type: 'logs', uid: 'elastic-uid' } }],
        range: { from: 'now-1h', to: 'now' },
      }),
      orgId: '1',
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
    expect(screen.getByText(`loki Editor input: { label="value"}`)).toBeInTheDocument();
    expect(screen.getByText(`elastic Editor input: error`)).toBeInTheDocument();

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
      left: JSON.stringify({ datasource: 'loki', queries: [{ refId: 'A' }], range: { from: 'now-1h', to: 'now' } }),
      right: JSON.stringify({ datasource: 'elastic', queries: [{ refId: 'A' }], range: { from: 'now-1h', to: 'now' } }),
    };

    const { location } = setupExplore({ urlParams });
    let closeButtons = await screen.findAllByLabelText(/Close split pane/i);
    await userEvent.click(closeButtons[1]);

    expect(location.getHistory().length).toBe(1);

    await waitFor(() => {
      closeButtons = screen.queryAllByLabelText(/Close split pane/i);
      expect(closeButtons.length).toBe(0);
      // Closing a pane using the split close button causes a new entry to be pushed in the history
      expect(location.getHistory().length).toBe(2);
    });
  });

  it('handles opening split with split open func', async () => {
    const urlParams = {
      left: JSON.stringify({
        datasource: 'loki',
        queries: [{ refId: 'A' }, { expr: '{ label="value"}' }],
        range: { from: 'now-1h', to: 'now' },
      }),
    };

    const { datasources, store } = setupExplore({ urlParams });
    jest.mocked(datasources.loki.query).mockReturnValue(makeLogsQueryResponse());
    jest.mocked(datasources.elastic.query).mockReturnValue(makeLogsQueryResponse());

    // Wait for the left pane to render
    await waitFor(async () => {
      expect(await screen.findByText(`loki Editor input: { label="value"}`)).toBeInTheDocument();
    });

    act(() => {
      store.dispatch(mainState.splitOpen({ datasourceUid: 'elastic', queries: [{ expr: 'error', refId: 'A' }] }));
    });

    // Editor renders the new query
    expect(await screen.findByText(`elastic Editor input: error`)).toBeInTheDocument();
    expect(await screen.findByText(`loki Editor input: { label="value"}`)).toBeInTheDocument();
  });

  it('handles split size events and sets relevant variables', async () => {
    setupExplore();

    const splitButton = await screen.findByText(/split/i);
    await userEvent.click(splitButton);
    await waitForExplore('left');

    expect(await screen.findAllByLabelText('Widen pane')).toHaveLength(2);
    expect(screen.queryByLabelText('Narrow pane')).not.toBeInTheDocument();

    const panes = screen.getAllByRole('main');

    expect(Number.parseInt(getComputedStyle(panes[0]).width, 10)).toBe(1000);
    expect(Number.parseInt(getComputedStyle(panes[1]).width, 10)).toBe(1000);
    const resizer = screen.getByRole('presentation');

    fireEvent.mouseDown(resizer, { buttons: 1 });
    fireEvent.mouseMove(resizer, { clientX: -700, buttons: 1 });
    fireEvent.mouseUp(resizer);

    expect(await screen.findAllByLabelText('Widen pane')).toHaveLength(1);
    expect(await screen.findAllByLabelText('Narrow pane')).toHaveLength(1);
  });
});
