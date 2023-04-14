import { render, waitFor, screen, fireEvent, within, Matcher, getByRole } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { merge, uniqueId } from 'lodash';
import React from 'react';
import { Observable } from 'rxjs';
import { TestProvider } from 'test/helpers/TestProvider';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { DataSourcePluginMeta } from '@grafana/data';
import { BackendSrv, setDataSourceSrv, BackendSrvRequest, reportInteraction } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';

import { mockDataSource, MockDataSourceSrv } from '../alerting/unified/mocks';

import CorrelationsPage from './CorrelationsPage';
import {
  createCreateCorrelationResponse,
  createFetchCorrelationsError,
  createFetchCorrelationsResponse,
  createRemoveCorrelationResponse,
  createUpdateCorrelationResponse,
} from './__mocks__/useCorrelations.mocks';
import { Correlation, CreateCorrelationParams } from './types';

const renderWithContext = async (
  datasources: ConstructorParameters<typeof MockDataSourceSrv>[0] = {},
  correlations: Correlation[] = []
) => {
  const backend = {
    delete: async (url: string) => {
      const matches = url.match(
        /^\/api\/datasources\/uid\/(?<dsUid>[a-zA-Z0-9]+)\/correlations\/(?<correlationUid>[a-zA-Z0-9]+)$/
      );

      if (matches?.groups) {
        const { dsUid, correlationUid } = matches.groups;
        correlations = correlations.filter((c) => c.uid !== correlationUid || c.sourceUID !== dsUid);
        return createRemoveCorrelationResponse();
      }

      throw createFetchCorrelationsError();
    },
    post: async (url: string, data: Omit<CreateCorrelationParams, 'sourceUID'>) => {
      const matches = url.match(/^\/api\/datasources\/uid\/(?<sourceUID>[a-zA-Z0-9]+)\/correlations$/);
      if (matches?.groups) {
        const { sourceUID } = matches.groups;
        const correlation = { sourceUID, ...data, uid: uniqueId() };
        correlations.push(correlation);
        return createCreateCorrelationResponse(correlation);
      }

      throw createFetchCorrelationsError();
    },
    patch: async (url: string, data: Omit<CreateCorrelationParams, 'sourceUID'>) => {
      const matches = url.match(
        /^\/api\/datasources\/uid\/(?<sourceUID>[a-zA-Z0-9]+)\/correlations\/(?<correlationUid>[a-zA-Z0-9]+)$/
      );
      if (matches?.groups) {
        const { sourceUID, correlationUid } = matches.groups;
        correlations = correlations.map((c) => {
          if (c.uid === correlationUid && sourceUID === c.sourceUID) {
            return { ...c, ...data };
          }
          return c;
        });
        return createUpdateCorrelationResponse({ sourceUID, ...data, uid: uniqueId() });
      }

      throw createFetchCorrelationsError();
    },
    fetch: (options: BackendSrvRequest) => {
      return new Observable((s) => {
        s.next(merge(createFetchCorrelationsResponse({ url: options.url, data: correlations })));
        s.complete();
      });
    },
  } as unknown as BackendSrv;
  const grafanaContext = getGrafanaContextMock({ backend });

  const dsServer = new MockDataSourceSrv(datasources);
  dsServer.get = (name: string) => {
    const dsApi = new MockDataSourceApi(name);
    dsApi.components = {
      QueryEditor: () => <>{name} query editor</>,
    };
    return Promise.resolve(dsApi);
  };

  setDataSourceSrv(dsServer);

  const renderResult = render(
    <TestProvider store={configureStore({})} grafanaContext={grafanaContext}>
      <CorrelationsPage />
    </TestProvider>,
    {
      queries: {
        /**
         * Gets all the rows in the table having the given text in the given column
         */
        queryRowsByCellValue: (
          container: HTMLElement,
          columnName: Matcher,
          textValue: Matcher
        ): HTMLTableRowElement[] => {
          const table = within(container).getByRole('table');
          const headers = within(table).getAllByRole('columnheader');
          const headerIndex = headers.findIndex((h) => {
            return within(h).queryByText(columnName);
          });

          // the first rowgroup is the header
          const tableBody = within(table).getAllByRole('rowgroup')[1];

          return within(tableBody)
            .getAllByRole<HTMLTableRowElement>('row')
            .filter((row) => {
              const rowCells = within(row).getAllByRole('cell');
              const cell = rowCells[headerIndex];
              return within(cell).queryByText(textValue);
            });
        },
        /**
         * Gets all the cells in the table for the given column name
         */
        queryCellsByColumnName: (container: HTMLElement, columnName: Matcher) => {
          const table = within(container).getByRole('table');
          const headers = within(table).getAllByRole('columnheader');
          const headerIndex = headers.findIndex((h) => {
            return within(h).queryByText(columnName);
          });
          const tbody = table.querySelector('tbody');
          if (!tbody) {
            return [];
          }
          return within(tbody)
            .getAllByRole('row')
            .map((r) => {
              const cells = within(r).getAllByRole<HTMLTableCellElement>('cell');
              return cells[headerIndex];
            });
        },
        /**
         * Gets the table header cell matching the given name
         */
        getHeaderByName: (container: HTMLElement, columnName: Matcher): HTMLTableCellElement => {
          const table = within(container).getByRole('table');
          const headers = within(table).getAllByRole<HTMLTableCellElement>('columnheader');
          const header = headers.find((h) => {
            return within(h).queryByText(columnName);
          });
          if (!header) {
            throw new Error(`Could not find header with name ${columnName}`);
          }
          return header;
        },
      },
    }
  );

  await waitFor(() => {
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });

  return renderResult;
};

jest.mock('app/core/services/context_srv');

const mocks = {
  contextSrv: jest.mocked(contextSrv),
  reportInteraction: jest.fn(),
};

jest.mock('@grafana/runtime', () => {
  const runtime = jest.requireActual('@grafana/runtime');

  return {
    ...runtime,
    config: {
      ...runtime.config,
      featureToggles: {
        ...runtime.config.featureToggles,
        topnav: true,
      },
    },
    reportInteraction: (...args: Parameters<typeof reportInteraction>) => {
      mocks.reportInteraction(...args);
    },
  };
});

beforeAll(() => {
  mocks.contextSrv.hasPermission.mockImplementation(() => true);
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('CorrelationsPage', () => {
  describe('With no correlations', () => {
    beforeEach(async () => {
      await renderWithContext({
        loki: mockDataSource(
          {
            uid: 'loki',
            name: 'loki',
            readOnly: false,
            jsonData: {},
            access: 'direct',
            type: 'datasource',
          },
          { logs: true }
        ),
        prometheus: mockDataSource(
          {
            uid: 'prometheus',
            name: 'prometheus',
            readOnly: false,
            jsonData: {},
            access: 'direct',
            type: 'datasource',
          },
          { metrics: true }
        ),
      });
    });

    afterEach(() => {
      mocks.reportInteraction.mockClear();
    });

    it('shows the first page of the wizard', async () => {
      const CTAButton = await screen.findByRole('button', { name: /add correlation/i });
      expect(CTAButton).toBeInTheDocument();

      // insert form should not be present
      expect(screen.queryByRole('button', { name: /next$/i })).not.toBeInTheDocument();

      // "add new" button is the button on the top of the page, not visible when the CTA is rendered
      expect(screen.queryByRole('button', { name: /add new$/i })).not.toBeInTheDocument();

      // there's no table in the page
      expect(screen.queryByRole('table')).not.toBeInTheDocument();

      await userEvent.click(CTAButton);

      // form's next button
      expect(await screen.findByRole('button', { name: /next$/i })).toBeInTheDocument();
    });

    it('correctly adds first correlation', async () => {
      const CTAButton = await screen.findByRole('button', { name: /add correlation/i });
      expect(CTAButton).toBeInTheDocument();

      // there's no table in the page, as we are adding the first correlation
      expect(screen.queryByRole('table')).not.toBeInTheDocument();

      await userEvent.click(CTAButton);

      // step 1: label and description
      await userEvent.clear(screen.getByRole('textbox', { name: /label/i }));
      await userEvent.type(screen.getByRole('textbox', { name: /label/i }), 'A Label');
      await userEvent.clear(screen.getByRole('textbox', { name: /description/i }));
      await userEvent.type(screen.getByRole('textbox', { name: /description/i }), 'A Description');
      await userEvent.click(await screen.findByRole('button', { name: /next$/i }));

      // step 2:
      // set target datasource picker value
      fireEvent.keyDown(screen.getByLabelText(/^target/i), { keyCode: 40 });
      await userEvent.click(screen.getByText('prometheus'));
      await userEvent.click(await screen.findByRole('button', { name: /next$/i }));

      // step 3:
      // set source datasource picker value
      fireEvent.keyDown(screen.getByLabelText(/^source/i), { keyCode: 40 });
      await userEvent.click(screen.getByText('loki'));
      await userEvent.click(await screen.findByRole('button', { name: /add$/i }));

      await userEvent.clear(screen.getByRole('textbox', { name: /results field/i }));
      await userEvent.type(screen.getByRole('textbox', { name: /results field/i }), 'Line');
      await userEvent.click(await screen.findByRole('button', { name: /add$/i }));

      expect(mocks.reportInteraction).toHaveBeenLastCalledWith('grafana_correlations_added');

      // the table showing correlations should have appeared
      expect(await screen.findByRole('table')).toBeInTheDocument();
    });
  });

  describe('With correlations', () => {
    afterEach(() => {
      mocks.reportInteraction.mockClear();
    });

    let queryRowsByCellValue: (columnName: Matcher, textValue: Matcher) => HTMLTableRowElement[];
    let getHeaderByName: (columnName: Matcher) => HTMLTableCellElement;
    let queryCellsByColumnName: (columnName: Matcher) => HTMLTableCellElement[];

    beforeEach(async () => {
      const renderResult = await renderWithContext(
        {
          loki: mockDataSource(
            {
              uid: 'loki',
              name: 'loki',
              readOnly: false,
              jsonData: {},
              access: 'direct',
              type: 'datasource',
            },
            {
              logs: true,
            }
          ),
          prometheus: mockDataSource(
            {
              uid: 'prometheus',
              name: 'prometheus',
              readOnly: false,
              jsonData: {},
              access: 'direct',
              type: 'datasource',
            },
            {
              metrics: true,
            }
          ),
          elastic: mockDataSource(
            {
              uid: 'elastic',
              name: 'elastic',
              readOnly: false,
              jsonData: {},
              access: 'direct',
              type: 'datasource',
            },
            {
              metrics: true,
              logs: true,
            }
          ),
        },
        [
          {
            sourceUID: 'loki',
            targetUID: 'loki',
            uid: '1',
            label: 'Some label',
            config: { field: 'line', target: {}, type: 'query' },
          },
          {
            sourceUID: 'prometheus',
            targetUID: 'loki',
            uid: '2',
            label: 'Prometheus to Loki',
            config: { field: 'label', target: {}, type: 'query' },
          },
        ]
      );
      queryRowsByCellValue = renderResult.queryRowsByCellValue;
      queryCellsByColumnName = renderResult.queryCellsByColumnName;
      getHeaderByName = renderResult.getHeaderByName;
    });

    it('shows a table with correlations', async () => {
      expect(await screen.findByRole('table')).toBeInTheDocument();
    });

    it('correctly sorts by source', async () => {
      // wait for table to appear
      await screen.findByRole('table');

      const sourceHeader = getByRole(getHeaderByName('Source'), 'button');
      await userEvent.click(sourceHeader);
      let cells = queryCellsByColumnName('Source');
      cells.forEach((cell, i, allCells) => {
        const prevCell = allCells[i - 1];
        if (prevCell && prevCell.textContent) {
          expect(cell.textContent?.localeCompare(prevCell.textContent)).toBeGreaterThanOrEqual(0);
        }
      });

      await userEvent.click(sourceHeader);
      cells = queryCellsByColumnName('Source');
      cells.forEach((cell, i, allCells) => {
        const prevCell = allCells[i - 1];
        if (prevCell && prevCell.textContent) {
          expect(cell.textContent?.localeCompare(prevCell.textContent)).toBeLessThanOrEqual(0);
        }
      });
    });

    it('correctly adds new correlation', async () => {
      const addNewButton = await screen.findByRole('button', { name: /add new/i });
      expect(addNewButton).toBeInTheDocument();
      await userEvent.click(addNewButton);

      // step 1:
      await userEvent.clear(screen.getByRole('textbox', { name: /label/i }));
      await userEvent.type(screen.getByRole('textbox', { name: /label/i }), 'A Label');
      await userEvent.clear(screen.getByRole('textbox', { name: /description/i }));
      await userEvent.type(screen.getByRole('textbox', { name: /description/i }), 'A Description');
      await userEvent.click(await screen.findByRole('button', { name: /next$/i }));

      // step 2:
      // set target datasource picker value
      fireEvent.keyDown(screen.getByLabelText(/^target/i), { keyCode: 40 });
      await userEvent.click(screen.getByText('elastic'));
      await userEvent.click(await screen.findByRole('button', { name: /next$/i }));

      // step 3:
      // set source datasource picker value
      fireEvent.keyDown(screen.getByLabelText(/^source/i), { keyCode: 40 });
      await userEvent.click(within(screen.getByLabelText('Select options menu')).getByText('prometheus'));

      await userEvent.clear(screen.getByRole('textbox', { name: /results field/i }));
      await userEvent.type(screen.getByRole('textbox', { name: /results field/i }), 'Line');

      await userEvent.click(screen.getByRole('button', { name: /add$/i }));

      expect(mocks.reportInteraction).toHaveBeenLastCalledWith('grafana_correlations_added');

      // the table showing correlations should have appeared
      expect(await screen.findByRole('table')).toBeInTheDocument();
    });

    it('correctly closes the form when clicking on the close icon', async () => {
      const addNewButton = await screen.findByRole('button', { name: /add new/i });
      expect(addNewButton).toBeInTheDocument();
      await userEvent.click(addNewButton);

      await userEvent.click(screen.getByRole('button', { name: /close$/i }));

      expect(screen.queryByRole('button', { name: /add$/i })).not.toBeInTheDocument();
    });

    it('correctly deletes correlations', async () => {
      // A row with the correlation should exist
      expect(await screen.findByRole('cell', { name: /some label/i })).toBeInTheDocument();

      const tableRows = queryRowsByCellValue('Source', 'loki');

      const deleteButton = within(tableRows[0]).getByRole('button', { name: /delete correlation/i });

      expect(deleteButton).toBeInTheDocument();

      await userEvent.click(deleteButton);

      const confirmButton = within(tableRows[0]).getByRole('button', { name: /delete$/i });
      expect(confirmButton).toBeInTheDocument();

      await userEvent.click(confirmButton);

      expect(screen.queryByRole('cell', { name: /some label$/i })).not.toBeInTheDocument();

      expect(mocks.reportInteraction).toHaveBeenLastCalledWith('grafana_correlations_deleted');
    });

    it('correctly edits correlations', async () => {
      // wait for table to appear
      await screen.findByRole('table');

      const tableRows = queryRowsByCellValue('Source', 'loki');

      const rowExpanderButton = within(tableRows[0]).getByRole('button', { name: /toggle row expanded/i });
      await userEvent.click(rowExpanderButton);

      expect(mocks.reportInteraction).toHaveBeenLastCalledWith('grafana_correlations_details_expanded');

      await userEvent.clear(screen.getByRole('textbox', { name: /label/i }));
      await userEvent.type(screen.getByRole('textbox', { name: /label/i }), 'edited label');
      await userEvent.clear(screen.getByRole('textbox', { name: /description/i }));
      await userEvent.type(screen.getByRole('textbox', { name: /description/i }), 'edited description');

      expect(screen.queryByRole('cell', { name: /edited label$/i })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /next$/i }));
      await userEvent.click(screen.getByRole('button', { name: /next$/i }));
      await userEvent.click(screen.getByRole('button', { name: /save$/i }));

      expect(await screen.findByRole('cell', { name: /edited label$/i })).toBeInTheDocument();

      expect(mocks.reportInteraction).toHaveBeenLastCalledWith('grafana_correlations_edited');
    });
  });

  describe('Read only correlations', () => {
    const correlations: Correlation[] = [
      {
        sourceUID: 'loki',
        targetUID: 'loki',
        uid: '1',
        label: 'Some label',
        config: { field: 'line', target: {}, type: 'query' },
      },
    ];

    beforeEach(async () => {
      await renderWithContext(
        {
          loki: mockDataSource({
            uid: 'loki',
            name: 'loki',
            readOnly: true,
            jsonData: {},
            access: 'direct',
            meta: { info: { logos: {} } } as DataSourcePluginMeta,
            type: 'datasource',
          }),
        },
        correlations
      );
    });

    it("doesn't render delete button", async () => {
      // A row with the correlation should exist
      expect(await screen.findByRole('cell', { name: /some label/i })).toBeInTheDocument();

      expect(screen.queryByRole('button', { name: /delete correlation/i })).not.toBeInTheDocument();
    });

    it('edit form is read only', async () => {
      // A row with the correlation should exist
      const rowExpanderButton = await screen.findByRole('button', { name: /toggle row expanded/i });

      await userEvent.click(rowExpanderButton);

      expect(mocks.reportInteraction).toHaveBeenLastCalledWith('grafana_correlations_details_expanded');

      // form elements should be readonly
      const labelInput = await screen.findByRole('textbox', { name: /label/i });
      expect(labelInput).toBeInTheDocument();
      expect(labelInput).toHaveAttribute('readonly');

      const descriptionInput = screen.getByRole('textbox', { name: /description/i });
      expect(descriptionInput).toBeInTheDocument();
      expect(descriptionInput).toHaveAttribute('readonly');

      // we don't expect the save button to be rendered
      expect(screen.queryByRole('button', { name: 'save' })).not.toBeInTheDocument();
    });
  });
});
