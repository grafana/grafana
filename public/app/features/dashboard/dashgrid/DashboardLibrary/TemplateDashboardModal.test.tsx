import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { TemplateDashboardModal } from './TemplateDashboardModal';

setBackendSrv(backendSrv);
setupMockServer();

const mockGetList = jest
  .fn()
  .mockReturnValue([{ name: 'Test Data Source', uid: 'test-data-source-uid', type: 'grafana-testdata-datasource' }]);

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    getDataSourceSrv: () => ({
      getList: mockGetList,
    }),
  };
});

describe('TemplateDashboardModal', () => {
  beforeEach(() => {
    mockGetList.mockReturnValue([
      { name: 'Test Data Source', uid: 'test-data-source-uid', type: 'grafana-testdata-datasource' },
    ]);
    server.use(
      http.get('/api/gnet/dashboards', () => {
        return HttpResponse.json({
          page: 1,
          pages: 1,
          items: [
            {
              id: 1,
              name: 'Test Template Dashboard',
              description: 'A test template dashboard',
              downloads: 100,
              datasource: 'grafana-testdata-datasource',
            },
            {
              id: 2,
              name: 'Test Template Dashboard 2',
              description: 'A test template dashboard 2',
              downloads: 100,
              datasource: 'grafana-testdata-datasource',
            },
          ],
        });
      })
    );
  });

  describe('Render conditions', () => {
    it('should show TemplateDashboard modal when query param is present, test data source is available and there are template dashboards', async () => {
      render(<TemplateDashboardModal />, {
        historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
      });
      expect(await screen.findByRole('dialog', { name: 'Start a dashboard from a template' })).toBeInTheDocument();
    });

    it('should not show TemplateDashboard modal when query param is present but test data source is not available', async () => {
      mockGetList.mockReturnValueOnce([]);
      render(<TemplateDashboardModal />, {
        historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
      });
      expect(screen.queryByRole('dialog', { name: 'Start a dashboard from a template' })).not.toBeInTheDocument();
    });

    it('should not show TemplateDashboard modal when query param is present but there are no template dashboards', async () => {
      server.use(
        http.get('/api/gnet/dashboards', () => {
          return HttpResponse.json({
            page: 1,
            pages: 1,
            items: [],
          });
        })
      );
      render(<TemplateDashboardModal />, {
        historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
      });
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Start a dashboard from a template' })).not.toBeInTheDocument();
      });
    });

    it('should not show TemplateDashboard modal when query param is not present', async () => {
      render(<TemplateDashboardModal />);
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Start a dashboard from a template' })).not.toBeInTheDocument();
      });
    });
  });

  describe('Render content', () => {
    it('should render title and description', async () => {
      render(<TemplateDashboardModal />, {
        historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
      });

      await waitFor(() => {
        expect(screen.getByText('Start a dashboard from a template')).toBeInTheDocument();
      });

      expect(
        screen.getByText(
          'Get started with Grafana templates using sample data. Connect your data to power them with real metrics.'
        )
      ).toBeInTheDocument();
    });
    it('should show template dashboard cards', async () => {
      render(<TemplateDashboardModal />, {
        historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
      });

      await waitFor(() => {
        // Assert DashboardCard components are rendered by checking for their headings
        expect(screen.getByRole('heading', { name: 'Test Template Dashboard' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Test Template Dashboard 2' })).toBeInTheDocument();

        // Assert DashboardCard components are rendered by checking for "Use template" buttons
        const useTemplateButtons = screen.getAllByRole('button', { name: 'Use template' });
        expect(useTemplateButtons).toHaveLength(2);

        // Assert text content (descriptions)
        expect(screen.getByText('A test template dashboard')).toBeInTheDocument();
        expect(screen.getByText('A test template dashboard 2')).toBeInTheDocument();
      });
    });
  });
});
