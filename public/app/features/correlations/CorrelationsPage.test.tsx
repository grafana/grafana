import { render, waitFor, screen, within, Matcher, getByRole } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { merge, uniqueId } from 'lodash';
import { openMenu } from 'react-select-event';
import { Observable } from 'rxjs';
import { TestProvider } from 'test/helpers/TestProvider';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { SupportedTransformationType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  BackendSrv,
  BackendSrvRequest,
  DataSourceSrv,
  reportInteraction,
  setAppEvents,
  setDataSourceSrv,
} from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';

import { mockDataSource } from '../alerting/unified/mocks';

import CorrelationsPage from './CorrelationsPage';
import {
  createCreateCorrelationResponse,
  createFetchCorrelationsError,
  createFetchCorrelationsResponse,
  createRemoveCorrelationResponse,
  createUpdateCorrelationResponse,
  MockDataSourceSrv,
} from './mocks/useCorrelations.mocks';
import { Correlation, CreateCorrelationParams, OmitUnion } from './types';

// Set app events up, otherwise plugin modules will fail to load
setAppEvents(appEvents);

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
    post: async (url: string, data: OmitUnion<CreateCorrelationParams, 'sourceUID'>) => {
      const matches = url.match(/^\/api\/datasources\/uid\/(?<sourceUID>[a-zA-Z0-9]+)\/correlations$/);
      if (matches?.groups) {
        const { sourceUID } = matches.groups;
        const correlation = { sourceUID, ...data, uid: uniqueId(), provisioned: false };
        correlations.push(correlation);
        return createCreateCorrelationResponse(correlation);
      }

      throw createFetchCorrelationsError();
    },
    patch: async (url: string, data: OmitUnion<CreateCorrelationParams, 'sourceUID'>) => {
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
        return createUpdateCorrelationResponse({ sourceUID, ...data, uid: uniqueId(), provisioned: false });
      }

      throw createFetchCorrelationsError();
    },
    fetch: (options: BackendSrvRequest) => {
      return new Observable((s) => {
        s.next(
          merge(
            createFetchCorrelationsResponse({
              url: options.url,
              data: { correlations, page: 1, limit: 5, totalCount: 0 },
            })
          )
        );
        s.complete();
      });
    },
  } as unknown as BackendSrv;
  const grafanaContext = getGrafanaContextMock({ backend });
  const dsServer = new MockDataSourceSrv(datasources) as unknown as DataSourceSrv;
  dsServer.get = (name: string) => {
    const dsApi = new MockDataSourceApi(name);
    // Mock the QueryEditor component
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
            type: 'datasource',
          },
          { metrics: true, module: 'core:plugin/prometheus' }
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
      await userEvent.click(screen.getByLabelText(/^target/i));
      await userEvent.click(screen.getByText('prometheus'));
      await userEvent.click(await screen.findByRole('button', { name: /next$/i }));

      // step 3:
      // set source datasource picker value
      await userEvent.click(screen.getByLabelText(/^source/i));
      await userEvent.click(screen.getByText('loki'));
      await userEvent.click(await screen.findByRole('button', { name: /add$/i }));

      await userEvent.clear(screen.getByRole('textbox', { name: /results field/i }));
      await userEvent.type(screen.getByRole('textbox', { name: /results field/i }), 'Line');

      // add transformation
      await userEvent.click(screen.getByRole('button', { name: /add transformation/i }));
      const typeFilterSelect = screen.getAllByLabelText('Type');
      openMenu(typeFilterSelect[0]);
      await userEvent.click(screen.getByText('Regular expression'));
      await userEvent.type(screen.getByLabelText(/expression/i), 'test expression');

      await userEvent.click(await screen.findByRole('button', { name: /add$/i }));

      await waitFor(() => {
        expect(mocks.reportInteraction).toHaveBeenCalledWith('grafana_correlations_added');
      });

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
              type: 'datasource',
            },
            {
              metrics: true,
              module: 'core:plugin/prometheus',
            }
          ),
          elastic: mockDataSource(
            {
              uid: 'elastic',
              name: 'elastic',
              readOnly: false,
              jsonData: {},
              type: 'datasource',
            },
            {
              metrics: true,
              logs: true,
              module: 'core:plugin/elasticsearch',
            }
          ),
        },
        [
          {
            sourceUID: 'loki',
            targetUID: 'loki',
            uid: '1',
            label: 'Some label',
            provisioned: false,
            type: 'query',
            config: {
              field: 'line',
              target: {},
              transformations: [
                { type: SupportedTransformationType.Regex, expression: 'url=http[s]?://(S*)', mapValue: 'path' },
              ],
            },
          },
          {
            sourceUID: 'prometheus',
            targetUID: 'loki',
            uid: '2',
            label: 'Prometheus to Loki',
            type: 'query',
            config: { field: 'label', target: {} },
            provisioned: false,
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
      await userEvent.click(screen.getByLabelText(/^target/i));
      await userEvent.click(screen.getByText('elastic'));
      await userEvent.click(await screen.findByRole('button', { name: /next$/i }));

      // step 3:
      // set source datasource picker value
      await userEvent.click(screen.getByLabelText(/^source/i));
      await userEvent.click(
        within(screen.getByTestId(selectors.components.DataSourcePicker.dataSourceList)).getByText('prometheus')
      );

      await userEvent.clear(screen.getByRole('textbox', { name: /results field/i }));
      await userEvent.type(screen.getByRole('textbox', { name: /results field/i }), 'Line');

      await userEvent.click(screen.getByRole('button', { name: /add$/i }));

      await waitFor(() => {
        expect(mocks.reportInteraction).toHaveBeenCalledWith('grafana_correlations_added');
      });

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

      await waitFor(() => {
        expect(mocks.reportInteraction).toHaveBeenCalledWith('grafana_correlations_deleted');
      });
    });

    it('correctly edits correlations', async () => {
      // wait for table to appear
      await screen.findByRole('table');

      const tableRows = queryRowsByCellValue('Source', 'loki');

      const rowExpanderButton = within(tableRows[0]).getByRole('button', { name: /toggle row expanded/i });
      await userEvent.click(rowExpanderButton);

      await waitFor(() => {
        expect(mocks.reportInteraction).toHaveBeenCalledWith('grafana_correlations_details_expanded');
      });

      await userEvent.clear(screen.getByRole('textbox', { name: /label/i }));
      await userEvent.type(screen.getByRole('textbox', { name: /label/i }), 'edited label');
      await userEvent.clear(screen.getByRole('textbox', { name: /description/i }));
      await userEvent.type(screen.getByRole('textbox', { name: /description/i }), 'edited description');

      expect(screen.queryByRole('cell', { name: /edited label$/i })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /next$/i }));
      await userEvent.click(screen.getByRole('button', { name: /next$/i }));

      await userEvent.click(screen.getByRole('button', { name: /save$/i }));

      expect(await screen.findByRole('cell', { name: /edited label$/i }, { timeout: 5000 })).toBeInTheDocument();

      await waitFor(() => {
        expect(mocks.reportInteraction).toHaveBeenCalledWith('grafana_correlations_edited');
      });
    });

    it('correctly edits transformations', async () => {
      // wait for table to appear
      await screen.findByRole('table');

      const tableRows = queryRowsByCellValue('Source', 'loki');

      const rowExpanderButton = within(tableRows[0]).getByRole('button', { name: /toggle row expanded/i });
      await userEvent.click(rowExpanderButton);

      await userEvent.click(screen.getByRole('button', { name: /next$/i }));
      await userEvent.click(screen.getByRole('button', { name: /next$/i }));

      // select Logfmt, be sure expression field is disabled
      let typeFilterSelect = screen.getAllByLabelText('Type');
      openMenu(typeFilterSelect[0]);
      await userEvent.click(screen.getByText('Logfmt'));

      let expressionInput = screen.queryByLabelText(/expression/i);
      expect(expressionInput).toBeInTheDocument();
      expect(expressionInput).toBeDisabled();

      // select Regex, be sure expression field is not disabled and contains the former expression
      openMenu(typeFilterSelect[0]);
      await userEvent.click(screen.getByText('Regular expression'));
      expressionInput = screen.queryByLabelText(/expression/i);
      expect(expressionInput).toBeInTheDocument();
      expect(expressionInput).toBeEnabled();
      expect(expressionInput).toHaveAttribute('value', 'url=http[s]?://(S*)');

      // select Logfmt, delete, then add a new one to be sure the value is blank
      openMenu(typeFilterSelect[0]);
      await userEvent.click(screen.getByText('Logfmt'));
      await userEvent.click(screen.getByRole('button', { name: /remove transformation/i }));
      expressionInput = screen.queryByLabelText(/expression/i);
      expect(expressionInput).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /add transformation/i }));
      typeFilterSelect = screen.getAllByLabelText('Type');
      openMenu(typeFilterSelect[0]);
      const menu = await screen.findByLabelText('Select options menu');
      await userEvent.click(within(menu).getByText('Regular expression'));
      expressionInput = screen.queryByLabelText(/expression/i);
      expect(expressionInput).toBeInTheDocument();
      expect(expressionInput).toBeEnabled();
      expect(expressionInput).not.toHaveValue('url=http[s]?://(S*)');
      await userEvent.click(screen.getByRole('button', { name: /save$/i }));
      expect(screen.getByText('Please define an expression')).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText(/expression/i), 'test expression');
      await userEvent.click(screen.getByRole('button', { name: /save$/i }));
      await waitFor(() => {
        expect(mocks.reportInteraction).toHaveBeenCalledWith('grafana_correlations_edited');
      });
    });
  });

  describe('With correlations with datasources the user cannot access', () => {
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
        },
        [
          {
            sourceUID: 'loki',
            targetUID: 'loki',
            uid: '1',
            label: 'Loki to Loki',
            provisioned: false,
            type: 'query',
            config: {
              field: 'line',
              target: {},
              transformations: [
                { type: SupportedTransformationType.Regex, expression: 'url=http[s]?://(S*)', mapValue: 'path' },
              ],
            },
          },
          {
            sourceUID: 'loki',
            targetUID: 'prometheus',
            uid: '2',
            label: 'Loki to Prometheus',
            provisioned: false,
            type: 'query',
            config: {
              field: 'line',
              target: {},
              transformations: [
                { type: SupportedTransformationType.Regex, expression: 'url=http[s]?://(S*)', mapValue: 'path' },
              ],
            },
          },
          {
            sourceUID: 'prometheus',
            targetUID: 'loki',
            uid: '3',
            label: 'Prometheus to Loki',
            type: 'query',
            config: { field: 'label', target: {} },
            provisioned: false,
          },
          {
            sourceUID: 'prometheus',
            targetUID: 'prometheus',
            uid: '4',
            label: 'Prometheus to Prometheus',
            type: 'query',
            config: { field: 'label', target: {} },
            provisioned: false,
          },
        ]
      );
      queryCellsByColumnName = renderResult.queryCellsByColumnName;
    });

    it("doesn't show correlations from source or target datasources the user doesn't have access to", async () => {
      await screen.findByRole('table');

      const labels = queryCellsByColumnName('Label');
      expect(labels.length).toBe(1);
      expect(labels[0].textContent).toBe('Loki to Loki');
    });
  });

  describe('Read only correlations', () => {
    const correlations: Correlation[] = [
      {
        sourceUID: 'loki',
        targetUID: 'loki',
        uid: '1',
        label: 'Some label',
        provisioned: true,
        type: 'query',
        config: {
          field: 'line',
          target: {},
          transformations: [{ type: SupportedTransformationType.Regex, expression: '(?:msg)=' }],
        },
      },
    ];

    beforeEach(async () => {
      await renderWithContext(
        {
          loki: mockDataSource(
            {
              uid: 'loki',
              name: 'loki',
              readOnly: true,
              jsonData: {},
              access: 'direct',
              type: 'datasource',
            },
            { logs: true }
          ),
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

      await waitFor(() => {
        expect(mocks.reportInteraction).toHaveBeenCalledWith('grafana_correlations_details_expanded');
      });

      // form elements should be readonly
      const labelInput = await screen.findByRole('textbox', { name: /label/i });
      expect(labelInput).toBeInTheDocument();
      expect(labelInput).toHaveAttribute('readonly');

      const descriptionInput = screen.getByRole('textbox', { name: /description/i });
      expect(descriptionInput).toBeInTheDocument();
      expect(descriptionInput).toHaveAttribute('readonly');

      await userEvent.click(screen.getByRole('button', { name: /next$/i }));
      await userEvent.click(screen.getByRole('button', { name: /next$/i }));

      // expect the transformation to exist but be read only
      const expressionInput = screen.queryByLabelText(/expression/i);
      expect(expressionInput).toBeInTheDocument();
      expect(expressionInput).toHaveAttribute('readonly');
      expect(screen.queryByRole('button', { name: 'add transformation' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'remove transformation' })).not.toBeInTheDocument();

      // we don't expect the save button to be rendered
      expect(screen.queryByRole('button', { name: 'save' })).not.toBeInTheDocument();
    });
  });
});
