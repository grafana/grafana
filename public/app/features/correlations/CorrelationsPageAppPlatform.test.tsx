import { render, waitFor, screen, within, Matcher } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openMenu } from 'react-select-event';
import { TestProvider } from 'test/helpers/TestProvider';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { DataSourceInstanceSettings } from '@grafana/data';
import { DataSourceSrv, reportInteraction, setAppEvents, setDataSourceSrv, config } from '@grafana/runtime';
import { DataSourceRef } from '@grafana/schema';
import { appEvents } from 'app/core/app_events';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';

import { mockDataSource } from '../alerting/unified/mocks';

import { CorrelationsPageAppPlatform } from './CorrelationsPageWrapper';
import { setupCorrelationsMswServer } from './mocks/server';
import {
  createCorrelationsScenario,
  emptyCorrelationsScenario,
  existingCorrelationsScenario,
} from './mocks/server/correlations.scenario';
import { MockDataSourceSrv } from './mocks/useCorrelations.mocks';

const server = setupCorrelationsMswServer();

const originalFeatureToggles = config.featureToggles;

// Set app events up, otherwise plugin modules will fail to load
setAppEvents(appEvents);

const renderWithContext = async (datasources: ConstructorParameters<typeof MockDataSourceSrv>[0] = {}) => {
  const grafanaContext = getGrafanaContextMock();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const dsServer = new MockDataSourceSrv(datasources) as unknown as DataSourceSrv;
  dsServer.get = (name: string) => {
    const dsApi = new MockDataSourceApi(name);
    // Mock the QueryEditor component
    dsApi.components = {
      QueryEditor: () => <>{name} query editor</>,
    };
    return Promise.resolve(dsApi);
  };

  dsServer.getInstanceSettings = (ref: DataSourceRef | string) => {
    if (ref === undefined) {
      return undefined;
    } else if (typeof ref === 'string') {
      const type = ref === 'lokiUID' ? 'loki' : 'prometheus';
      return {
        uid: ref,
        name: `${type}-1`,
        type: type,
        meta: { info: { logos: { small: '' } } },
      } as unknown as DataSourceInstanceSettings;
    } else {
      return {
        uid: ref.uid,
        name: `${ref.type}-1`,
        type: ref.type,
        meta: { info: { logos: { small: '' } } },
      } as unknown as DataSourceInstanceSettings;
    }
  };

  setDataSourceSrv(dsServer);

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

      // we don't test that the table exists because it doesn't actually get added
    });
  });

  describe('With correlations', () => {
    beforeEach(async () => {
      server.use(...existingCorrelationsScenario);

      await renderWithContext({
        loki: mockDataSource(
          {
            uid: 'lokiUID',
            name: 'loki',
            readOnly: false,
            jsonData: {},
            type: 'loki',
          },
          { logs: true }
        ),
        prometheus: mockDataSource(
          {
            uid: 'prometheusUID',
            name: 'prometheus',
            readOnly: false,
            jsonData: {},
            type: 'prometheus',
          },
          { metrics: true, module: 'core:plugin/prometheus' }
        ),
      });
    });

    it('shows a table with correlations', async () => {
      expect(await screen.findByRole('table')).toBeInTheDocument();
    });
  });
});
