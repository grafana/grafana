import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ComponentProps } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { serializeStateToUrlParam } from '@grafana/data';
import { config } from '@grafana/runtime';
import { ExploreId } from 'app/types';

import { makeLogsQueryResponse } from './spec/helper/query';
import { setupExplore, tearDown, waitForExplore } from './spec/helper/setup';
import * as mainState from './state/main';

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
    default(props: ComponentProps<typeof AutoSizer>) {
      return <div>{props.children({ width: 1000, height: 1000 })}</div>;
    },
  };
});

describe('ExplorePage', () => {
  afterEach(() => {
    tearDown();
  });

  describe('Handles open/close splits and related events in UI and URL', () => {
    it('opens the split pane when split button is clicked', async () => {
      setupExplore();
      // Wait for rendering the editor
      const splitButton = await screen.findByRole('button', { name: /split/i });
      await userEvent.click(splitButton);
      await waitFor(() => {
        const editors = screen.getAllByText('loki Editor input:');
        expect(editors.length).toBe(2);
      });
    });

    it('inits with two panes if specified in url', async () => {
      const urlParams = {
        left: serializeStateToUrlParam({
          datasource: 'loki-uid',
          queries: [{ refId: 'A', expr: '{ label="value"}' }],
          range: { from: 'now-1h', to: 'now' },
        }),
        right: serializeStateToUrlParam({
          datasource: 'elastic-uid',
          queries: [{ refId: 'A', expr: 'error' }],
          range: { from: 'now-1h', to: 'now' },
        }),
      };

      const { datasources, location } = setupExplore({ urlParams });
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

      // We did not change the url
      expect(location.getSearchObject()).toEqual(expect.objectContaining(urlParams));

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

    // TODO: the following tests are using the compact format, we should use the current format instead
    // and have a dedicated test ensuring the compact format is parsed correctly
    it('can close a panel from a split', async () => {
      const urlParams = {
        left: JSON.stringify(['now-1h', 'now', 'loki', { refId: 'A' }]),
        right: JSON.stringify(['now-1h', 'now', 'elastic', { refId: 'A' }]),
      };
      setupExplore({ urlParams });
      let closeButtons = await screen.findAllByLabelText(/Close split pane/i);
      await userEvent.click(closeButtons[1]);

      await waitFor(() => {
        closeButtons = screen.queryAllByLabelText(/Close split pane/i);
        expect(closeButtons.length).toBe(0);
      });
    });

    it('Opens split pane when URL contains left and right', async () => {
      const urlParams = {
        left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]),
      };
      const { datasources, location } = setupExplore({ urlParams });
      jest.mocked(datasources.loki.query).mockReturnValue(makeLogsQueryResponse());
      jest.mocked(datasources.elastic.query).mockReturnValue(makeLogsQueryResponse());

      await waitFor(() => {
        expect(screen.getByText(`loki Editor input: { label="value"}`)).toBeInTheDocument();
      });

      act(() => {
        location.partial({
          left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]),
          right: JSON.stringify(['now-1h', 'now', 'elastic', { expr: 'error' }]),
        });
      });

      await waitFor(() => {
        expect(screen.getByText(`loki Editor input: { label="value"}`)).toBeInTheDocument();
        expect(screen.getByText(`elastic Editor input: error`)).toBeInTheDocument();
      });
    });

    it('handles opening split with split open func', async () => {
      const urlParams = {
        left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]),
      };
      const { datasources, store } = setupExplore({ urlParams });
      jest.mocked(datasources.loki.query).mockReturnValue(makeLogsQueryResponse());
      jest.mocked(datasources.elastic.query).mockReturnValue(makeLogsQueryResponse());

      // Wait for the left pane to render
      await waitFor(async () => {
        expect(await screen.findByText(`loki Editor input: { label="value"}`)).toBeInTheDocument();
      });

      act(() => {
        store.dispatch(mainState.splitOpen({ datasourceUid: 'elastic', query: { expr: 'error', refId: 'A' } }));
      });

      // Editor renders the new query
      expect(await screen.findByText(`elastic Editor input: error`)).toBeInTheDocument();
      expect(await screen.findByText(`loki Editor input: { label="value"}`)).toBeInTheDocument();
    });

    it('handles split size events and sets relevant variables', async () => {
      setupExplore();

      const splitButton = await screen.findByText(/split/i);
      await userEvent.click(splitButton);
      await waitForExplore(ExploreId.left, true);

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

  describe('Handles document title changes', () => {
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

      act(() => {
        store.dispatch(mainState.splitOpen({ datasourceUid: 'elastic', query: { expr: 'error', refId: 'A' } }));
      });
      await waitFor(() => expect(document.title).toEqual('Explore - loki | elastic - Grafana'));
    });
  });

  describe('Handles different URL datasource redirects', () => {
    describe('exploreMixedDatasource on', () => {
      beforeAll(() => {
        config.featureToggles.exploreMixedDatasource = true;
      });

      describe('When root datasource is not specified in the URL', () => {
        it('Redirects to default datasource', async () => {
          const { location } = setupExplore();
          await waitForExplore();

          await waitFor(() => {
            const urlParams = decodeURIComponent(location.getSearch().toString());

            expect(urlParams).toBe(
              'left={"datasource":"loki-uid","queries":[{"refId":"A","datasource":{"type":"logs","uid":"loki-uid"}}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
            );
          });
          expect(location.getHistory()).toHaveLength(1);
        });

        it('Redirects to last used datasource when available', async () => {
          const { location } = setupExplore({
            prevUsedDatasource: { orgId: 1, datasource: 'elastic-uid' },
          });
          await waitForExplore();

          await waitFor(() => {
            const urlParams = decodeURIComponent(location.getSearch().toString());
            expect(urlParams).toBe(
              'left={"datasource":"elastic-uid","queries":[{"refId":"A","datasource":{"type":"logs","uid":"elastic-uid"}}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
            );
          });
          expect(location.getHistory()).toHaveLength(1);
        });

        it("Redirects to first query's datasource", async () => {
          const { location } = setupExplore({
            urlParams: {
              left: '{"queries":[{"refId":"A","datasource":{"type":"logs","uid":"loki-uid"}}],"range":{"from":"now-1h","to":"now"}}',
            },
            prevUsedDatasource: { orgId: 1, datasource: 'elastic' },
          });
          await waitForExplore();

          await waitFor(() => {
            const urlParams = decodeURIComponent(location.getSearch().toString());
            expect(urlParams).toBe(
              'left={"datasource":"loki-uid","queries":[{"refId":"A","datasource":{"type":"logs","uid":"loki-uid"}}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
            );
          });
          expect(location.getHistory()).toHaveLength(1);
        });
      });

      describe('When root datasource is specified in the URL', () => {
        it('Uses the datasource in the URL', async () => {
          const { location } = setupExplore({
            urlParams: {
              left: '{"datasource":"elastic-uid","queries":[{"refId":"A"}],"range":{"from":"now-1h","to":"now"}}',
            },
            prevUsedDatasource: { orgId: 1, datasource: 'elastic' },
          });
          await waitForExplore();

          await waitFor(() => {
            const urlParams = decodeURIComponent(location.getSearch().toString());
            expect(urlParams).toBe(
              'left={"datasource":"elastic-uid","queries":[{"refId":"A"}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
            );
          });

          expect(location.getHistory()).toHaveLength(1);
        });

        it('Filters out queries not using the root datasource', async () => {
          const { location } = setupExplore({
            urlParams: {
              left: '{"datasource":"elastic-uid","queries":[{"refId":"A","datasource":{"type":"logs","uid":"loki-uid"}},{"refId":"B","datasource":{"type":"logs","uid":"elastic-uid"}}],"range":{"from":"now-1h","to":"now"}}',
            },
            prevUsedDatasource: { orgId: 1, datasource: 'elastic' },
          });
          await waitForExplore();

          await waitFor(() => {
            const urlParams = decodeURIComponent(location.getSearch().toString());
            expect(urlParams).toBe(
              'left={"datasource":"elastic-uid","queries":[{"refId":"B","datasource":{"type":"logs","uid":"elastic-uid"}}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
            );
          });
        });

        it('Fallbacks to last used datasource if root datasource does not exist', async () => {
          const { location } = setupExplore({
            urlParams: { left: '{"datasource":"NON-EXISTENT","range":{"from":"now-1h","to":"now"}}' },
            prevUsedDatasource: { orgId: 1, datasource: 'elastic' },
          });
          await waitForExplore();

          await waitFor(() => {
            const urlParams = decodeURIComponent(location.getSearch().toString());
            expect(urlParams).toBe(
              'left={"datasource":"elastic-uid","queries":[{"refId":"A","datasource":{"type":"logs","uid":"elastic-uid"}}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
            );
          });
        });

        it('Fallbacks to default datasource if root datasource does not exist and last used datasource does not exist', async () => {
          const { location } = setupExplore({
            urlParams: { left: '{"datasource":"NON-EXISTENT","range":{"from":"now-1h","to":"now"}}' },
            prevUsedDatasource: { orgId: 1, datasource: 'I DO NOT EXIST' },
          });
          await waitForExplore();

          await waitFor(() => {
            const urlParams = decodeURIComponent(location.getSearch().toString());
            expect(urlParams).toBe(
              'left={"datasource":"loki-uid","queries":[{"refId":"A","datasource":{"type":"logs","uid":"loki-uid"}}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
            );
          });
        });

        it('Fallbacks to default datasource if root datasource does not exist there is no last used datasource', async () => {
          const { location } = setupExplore({
            urlParams: { left: '{"datasource":"NON-EXISTENT","range":{"from":"now-1h","to":"now"}}' },
          });
          await waitForExplore();

          await waitFor(() => {
            const urlParams = decodeURIComponent(location.getSearch().toString());
            expect(urlParams).toBe(
              'left={"datasource":"loki-uid","queries":[{"refId":"A","datasource":{"type":"logs","uid":"loki-uid"}}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
            );
          });
        });
      });

      it('Queries using nonexisting datasources gets removed', async () => {
        const { location } = setupExplore({
          urlParams: {
            left: '{"datasource":"-- Mixed --","queries":[{"refId":"A","datasource":{"type":"NON-EXISTENT","uid":"NON-EXISTENT"}},{"refId":"B","datasource":{"type":"logs","uid":"elastic-uid"}}],"range":{"from":"now-1h","to":"now"}}',
          },
          prevUsedDatasource: { orgId: 1, datasource: 'elastic' },
        });
        await waitForExplore();

        await waitFor(() => {
          const urlParams = decodeURIComponent(location.getSearch().toString());
          expect(urlParams).toBe(
            'left={"datasource":"--+Mixed+--","queries":[{"refId":"B","datasource":{"type":"logs","uid":"elastic-uid"}}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
          );
        });
      });

      it('Only keeps queries using root datasource', async () => {
        const { location } = setupExplore({
          urlParams: {
            left: '{"datasource":"elastic-uid","queries":[{"refId":"A","datasource":{"type":"logs","uid":"loki-uid"}},{"refId":"B","datasource":{"type":"logs","uid":"elastic-uid"}}],"range":{"from":"now-1h","to":"now"}}',
          },
          prevUsedDatasource: { orgId: 1, datasource: 'elastic' },
        });

        await waitForExplore(undefined, true);

        await waitFor(() => {
          const urlParams = decodeURIComponent(location.getSearch().toString());
          // because there are no import/export queries in our mock datasources, only the first one remains

          expect(urlParams).toBe(
            'left={"datasource":"elastic-uid","queries":[{"refId":"B","datasource":{"type":"logs","uid":"elastic-uid"}}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
          );
        });
      });
    });
  });

  // describe('exploreMixedDatasource off', () => {
  //   beforeAll(() => {
  //     config.featureToggles.exploreMixedDatasource = false;
  //   });

  //   // TODO: mixed in url should redirect to default datasource
  //   // TODO: mixed in url should redirect to last used datasource
  // });

  it('removes `from` and `to` parameters from url when first mounted', async () => {
    const { location } = setupExplore({ urlParams: { from: '1', to: '2' } });
    await waitForExplore();

    await waitFor(() => {
      expect(location.getSearchObject()).toEqual(expect.not.objectContaining({ from: '1', to: '2' }));
      expect(location.getSearchObject()).toEqual(expect.objectContaining({ orgId: '1' }));
    });
  });
});
