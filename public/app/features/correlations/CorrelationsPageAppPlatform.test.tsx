import { waitFor, within, Matcher, getByRole } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { merge, uniqueId } from 'lodash';
import { openMenu } from 'react-select-event';
import { Observable } from 'rxjs';
import { TestProvider } from 'test/helpers/TestProvider';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { render, screen } from 'test/test-utils';

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
import { appEvents } from 'app/core/app_events';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';

import { mockDataSource } from '../alerting/unified/mocks';

import { CorrelationsPageLegacy } from './CorrelationsPageWrapper';
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

  const renderResult = render(<CorrelationsPageLegacy />, {
    store: configureStore({}),
    grafanaContext: grafanaContext,
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
  });

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

describe('CorrelationsPage - Legacy', () => {
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
  });
});
