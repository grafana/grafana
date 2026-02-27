import { http, HttpResponse } from 'msw';
import { of } from 'rxjs';
import { render, screen, waitFor } from 'test/test-utils';

import { locationService, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import { DASHBOARD_LIBRARY_ROUTES } from '../types';

import { TemplateDashboardModal } from './TemplateDashboardModal';
import { TemplateDashboardInteractions } from './interactions';

const mockItemClicked = jest.spyOn(TemplateDashboardInteractions, 'itemClicked').mockImplementation();

setBackendSrv(backendSrv);
setupMockServer();

const mockGetList = jest
  .fn()
  .mockReturnValue([{ name: 'Test Data Source', uid: 'test-data-source-uid', type: 'grafana-testdata-datasource' }]);

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getDataSourceSrv: () => ({
      getList: mockGetList,
    }),
    locationService: {
      ...actual.locationService,
      push: jest.fn(),
    },
  };
});

const mockLocationServicePush = locationService.push as jest.MockedFunction<typeof locationService.push>;

jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(() => ({
    isAvailable: true,
    openAssistant: jest.fn(),
  })),
  createAssistantContextItem: jest.fn((type: string, data: object) => ({ type, ...data })),
  isAssistantAvailable: jest.fn(() => of(true)),
}));

describe('TemplateDashboardModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

        // Assert DashboardCard components are rendered by checking for "View template" buttons
        const viewTemplateButtons = screen.getAllByRole('button', { name: 'View template' });
        expect(viewTemplateButtons).toHaveLength(2);

        // Assert text content (descriptions)
        expect(screen.getByText('A test template dashboard')).toBeInTheDocument();
        expect(screen.getByText('A test template dashboard 2')).toBeInTheDocument();
      });
    });
  });

  describe('Assistant button', () => {
    describe('when feature flags are false', () => {
      beforeEach(() => {
        setTestFlags({
          dashboardTemplatesAssistantButton: false,
          'assistant.frontend.tools.dashboardTemplates': false,
        });
      });

      it('should not render Customize with Assistant button when both feature flags are false', async () => {
        render(<TemplateDashboardModal />, {
          historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
        });

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Test Template Dashboard' })).toBeInTheDocument();
        });

        expect(screen.queryByRole('button', { name: /Customize with Assistant/i })).not.toBeInTheDocument();
      });

      it('should not render Customize with Assistant button when dashboardTemplatesAssistantButton is false', async () => {
        setTestFlags({ dashboardTemplatesAssistantButton: false, 'assistant.frontend.tools.dashboardTemplates': true });

        render(<TemplateDashboardModal />, {
          historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
        });

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Test Template Dashboard' })).toBeInTheDocument();
        });

        expect(screen.queryByRole('button', { name: /Customize with Assistant/i })).not.toBeInTheDocument();
      });

      it('should not render Customize with Assistant button when assistant.frontend.tools.dashboardTemplates is false', async () => {
        setTestFlags({ dashboardTemplatesAssistantButton: true, 'assistant.frontend.tools.dashboardTemplates': false });

        render(<TemplateDashboardModal />, {
          historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
        });

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Test Template Dashboard' })).toBeInTheDocument();
        });

        expect(screen.queryByRole('button', { name: /Customize with Assistant/i })).not.toBeInTheDocument();
      });
    });

    describe('when feature flags are enabled', () => {
      beforeEach(() => {
        setTestFlags({ dashboardTemplatesAssistantButton: true, 'assistant.frontend.tools.dashboardTemplates': true });
      });

      it('should redirect to template dashboard URL when Customize with Assistant is clicked with correct parameters', async () => {
        const { user } = render(<TemplateDashboardModal />, {
          historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
        });

        await waitFor(() => {
          expect(screen.getAllByRole('button', { name: /Customize with Assistant/i })).toHaveLength(2);
        });

        await user.click(screen.getAllByRole('button', { name: /Customize with Assistant/i })[0]);

        await waitFor(() => {
          expect(mockLocationServicePush).toHaveBeenCalledTimes(1);
          const calledUrl = mockLocationServicePush.mock.calls[0][0];
          expect(calledUrl).toContain(DASHBOARD_LIBRARY_ROUTES.Template);
          expect(calledUrl).toContain('gnetId=1');
          expect(calledUrl).toContain('title=Test+Template+Dashboard');
          expect(calledUrl).toContain('assistantSource=assistant_button');
        });
      });

      it('should close modal when Customize with Assistant is clicked', async () => {
        const { user } = render(<TemplateDashboardModal />, {
          historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
        });

        await waitFor(() => {
          expect(screen.getAllByRole('button', { name: /Customize with Assistant/i })).toHaveLength(2);
        });

        await user.click(screen.getAllByRole('button', { name: /Customize with Assistant/i })[0]);

        await waitFor(() => {
          expect(screen.queryByRole('dialog', { name: 'Start a dashboard from a template' })).not.toBeInTheDocument();
        });
      });

      it('should track action assistant when Customize with Assistant is clicked', async () => {
        const { user } = render(<TemplateDashboardModal />, {
          historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
        });

        await waitFor(() => {
          expect(screen.getAllByRole('button', { name: /Customize with Assistant/i })).toHaveLength(2);
        });

        await user.click(screen.getAllByRole('button', { name: /Customize with Assistant/i })[0]);

        expect(mockItemClicked).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'assistant',
          })
        );
      });
    });
  });

  describe('View template button', () => {
    it('should track action view_template when View template is clicked', async () => {
      const { user } = render(<TemplateDashboardModal />, {
        historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
      });

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'View template' })).toHaveLength(2);
      });

      await user.click(screen.getAllByRole('button', { name: 'View template' })[0]);

      expect(mockItemClicked).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'view_template',
        })
      );
    });
  });
});
