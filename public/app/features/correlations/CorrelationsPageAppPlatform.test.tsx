import { render, waitFor, screen, within, type Matcher, getByRole } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openMenu } from 'react-select-event';
import { TestProvider } from 'test/helpers/TestProvider';
import { seedDataSources, watchDataSourceFallbacks } from 'test/helpers/seedDataSources';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { type DataSourceInstanceSettings } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { type reportInteraction, setAppEvents, config } from '@grafana/runtime';
import { mockBoundingClientRect } from '@grafana/test-utils';
import { appEvents } from 'app/core/app_events';
import { type createSuccessNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';

import { mockDataSource } from '../alerting/unified/mocks';

import { CorrelationsPageAppPlatform } from './CorrelationsPageWrapper';
import {
  createCorrelationsScenario,
  emptyCorrelationsScenario,
  deleteCorrelationsScenario,
  editCorrelationsScenario,
} from './__mocks__/correlations.scenario';
import { prePopulateCorrelations, setupMockCorrelations } from './__mocks__/fixtures';
import { setupCorrelationsMswServer } from './__mocks__/server';

const server = setupCorrelationsMswServer();

const originalFeatureToggles = config.featureToggles;

// Set app events up, otherwise plugin modules will fail to load
setAppEvents(appEvents);

// The fallback's warning is inert in public/app suites, so green plus a quiet console proves
// nothing. Spy on the logger instead and fail if a lookup resolved through the legacy service.
let dataSourceFallbacks: ReturnType<typeof watchDataSourceFallbacks> | undefined;

afterEach(() => {
  const fallbacks = dataSourceFallbacks;
  dataSourceFallbacks = undefined;
  fallbacks?.expectNoFallbacks(['instance', 'settings', 'list']);
});

const renderWithContext = async (datasources: Record<string, DataSourceInstanceSettings> = {}) => {
  const grafanaContext = getGrafanaContextMock();

  seedDataSources(
    Object.values(datasources).map((settings) => {
      const dsApi = new MockDataSourceApi(settings);
      // Mock the QueryEditor component
      dsApi.components = {
        QueryEditor: () => <>{settings.name} query editor</>,
      };
      return { settings, api: dsApi };
    }),
    { legacySrv: 'mock' }
  );
  dataSourceFallbacks = watchDataSourceFallbacks();

  // the new render method doesn't seem to offer custom queries for now, so we can't change over yet
  const renderResult = render(
    <TestProvider store={configureStore({})} grafanaContext={grafanaContext}>
      <CorrelationsPageAppPlatform />
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
  successNotif: jest.fn(),
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

jest.mock('app/core/copy/appNotification', () => {
  return {
    ...jest.requireActual('app/core/copy/appNotification'),
    createSuccessNotification: (...args: Parameters<typeof createSuccessNotification>) => {
      mocks.successNotif(...args);
    },
  };
});

beforeAll(() => {
  mockBoundingClientRect();
  mocks.contextSrv.hasPermission.mockImplementation(() => true);
  config.featureToggles.kubernetesCorrelations = true;
});

afterAll(() => {
  jest.restoreAllMocks();
  config.featureToggles = originalFeatureToggles;
});

describe('CorrelationsPage - App Platform', () => {
  describe('With no correlations', () => {
    beforeEach(async () => {
      server.use(...emptyCorrelationsScenario, ...createCorrelationsScenario);

      await renderWithContext({
        lokiUID: mockDataSource(
          {
            uid: 'lokiUID',
            name: 'loki',
            readOnly: false,
            jsonData: {},
            type: 'datasource',
          },
          { logs: true }
        ),
        prometheusUID: mockDataSource(
          {
            uid: 'prometheusUID',
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
      mocks.successNotif.mockClear();
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

      expect(mocks.successNotif).toHaveBeenCalledWith('Correlation created');
      expect(await screen.findByRole('table')).toBeInTheDocument();
    });
  });

  describe('With correlations', () => {
    afterEach(() => {
      mocks.reportInteraction.mockClear();
      mocks.successNotif.mockClear();
    });

    let queryRowsByCellValue: (columnName: Matcher, textValue: Matcher) => HTMLTableRowElement[];
    let getHeaderByName: (columnName: Matcher) => HTMLTableCellElement;
    let queryCellsByColumnName: (columnName: Matcher) => HTMLTableCellElement[];

    beforeEach(async () => {
      server.use(
        ...emptyCorrelationsScenario,
        ...createCorrelationsScenario,
        ...deleteCorrelationsScenario,
        ...editCorrelationsScenario
      );

      setupMockCorrelations();
      prePopulateCorrelations();

      const renderResult = await renderWithContext({
        lokiUID: mockDataSource(
          {
            uid: 'lokiUID',
            name: 'loki',
            readOnly: false,
            jsonData: {},
            type: 'loki',
          },
          { logs: true }
        ),
        prometheusUID: mockDataSource(
          {
            uid: 'prometheusUID',
            name: 'prometheus',
            readOnly: false,
            jsonData: {},
            type: 'prometheus',
          },
          { metrics: true, module: 'core:plugin/prometheus' }
        ),
        elasticUID: mockDataSource(
          {
            uid: 'elasticUID',
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
      });

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

      expect(mocks.successNotif).toHaveBeenCalledWith('Correlation created');
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
      expect(await screen.findByRole('cell', { name: /loki to loki/i })).toBeInTheDocument();

      const tableRows = queryRowsByCellValue('Source', 'loki');

      const deleteButton = within(tableRows[0]).getByRole('button', { name: /delete correlation/i });

      expect(deleteButton).toBeInTheDocument();

      await userEvent.click(deleteButton);

      const confirmButton = within(tableRows[0]).getByRole('button', { name: /delete$/i });
      expect(confirmButton).toBeInTheDocument();

      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(mocks.reportInteraction).toHaveBeenCalledWith('grafana_correlations_deleted');
        expect(screen.queryByRole('cell', { name: /loki to loki$/i })).not.toBeInTheDocument();
      });

      expect(mocks.successNotif).toHaveBeenCalledWith('Correlation deleted');
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

      await waitFor(() => {
        expect(mocks.reportInteraction).toHaveBeenCalledWith('grafana_correlations_edited');
      });

      expect(await screen.findByRole('cell', { name: /edited label$/i }, { timeout: 5000 })).toBeInTheDocument();
      expect(mocks.successNotif).toHaveBeenCalledWith('Correlation updated');
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
      expect(mocks.successNotif).toHaveBeenCalledWith('Correlation updated');
    });
  });

  describe('With correlations with datasources the user cannot access', () => {
    let queryCellsByColumnName: (columnName: Matcher) => HTMLTableCellElement[];
    beforeEach(async () => {
      server.use(...emptyCorrelationsScenario);

      prePopulateCorrelations();

      const renderResult = await renderWithContext({
        lokiUID: mockDataSource(
          {
            uid: 'lokiUID',
            name: 'lokiUID',
            readOnly: false,
            jsonData: {},
            access: 'direct',
            type: 'datasource',
          },
          {
            logs: true,
          }
        ),
      });
      queryCellsByColumnName = renderResult.queryCellsByColumnName;
    });

    it("doesn't show correlations from source or target datasources the user doesn't have access to", async () => {
      await screen.findByRole('table');
      const labels = queryCellsByColumnName('Label');
      expect(labels.length).toBe(1);
      expect(labels[0].textContent).toBe('Loki to Loki');
    });
  });

  //TODO add in provisioned correlations tests after discussing with app platform
});
