import { http, HttpResponse } from 'msw';
import { of } from 'rxjs';
import { render, screen, waitFor } from 'test/test-utils';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { config, locationService, setBackendSrv } from '@grafana/runtime';
import { useDataSourceInstanceList } from '@grafana/runtime/unstable';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { DASHBOARD_LIBRARY_ROUTES } from '../types';

import { TemplateDashboardModal } from './TemplateDashboardModal';
import { NewTemplateDashboardInteractions } from './analytics/main';
import { getDashboardTemplatesTab } from './enterprise-components/DashboardTemplatesTabExtension';
import { TemplateDashboardInteractions } from './interactions';

jest.mock('./enterprise-components/DashboardTemplatesTabExtension', () => ({
  getDashboardTemplatesTab: jest.fn(() => null),
}));

const mockGetDashboardTemplatesTab = jest.mocked(getDashboardTemplatesTab);

const MockCustomTemplatesTab = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
  <div data-testid="custom-templates-tab">Custom Templates Tab Content</div>
);

const mockItemClicked = jest.spyOn(TemplateDashboardInteractions, 'itemClicked').mockImplementation();
const mockNewItemClicked = jest.spyOn(NewTemplateDashboardInteractions, 'itemClicked').mockImplementation();
const mockLoaded = jest.spyOn(TemplateDashboardInteractions, 'loaded').mockImplementation();
const mockNewLoaded = jest.spyOn(NewTemplateDashboardInteractions, 'loaded').mockImplementation();

setBackendSrv(backendSrv);
setupMockServer();

const defaultTestDataSource = {
  name: 'Test Data Source',
  uid: 'test-data-source-uid',
  type: 'grafana-testdata-datasource',
} as DataSourceInstanceListItem;

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useDataSourceInstanceList: jest.fn(() => ({ isLoading: false, items: [] })),
}));

const mockUseDataSourceInstanceList = jest.mocked(useDataSourceInstanceList);

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    locationService: {
      ...actual.locationService,
      push: jest.fn(),
      getHistory: () => actual.locationService,
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
  let originalPermissions: typeof contextSrv.user.permissions;

  beforeEach(() => {
    jest.clearAllMocks();
    config.featureToggles.dashboardTemplates = true;
    mockUseDataSourceInstanceList.mockReturnValue({ isLoading: false, items: [defaultTestDataSource] });
    // Custom templates require the dashboardtemplates:read RBAC action; grant it by default so
    // the custom-tab tests work, and revoke it explicitly in the read-gating test.
    originalPermissions = contextSrv.user.permissions;
    contextSrv.user.permissions = { [AccessControlAction.DashboardTemplatesRead]: true };
    // Default: no custom templates tab registered (matches the real default before the
    // enterprise extension registers itself). Individual describes override this.
    mockGetDashboardTemplatesTab.mockReturnValue(null);
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
              slug: 'test-template-dashboard',
              downloads: 100,
              datasource: 'grafana-testdata-datasource',
            },
            {
              id: 2,
              name: 'Test Template Dashboard 2',
              description: 'A test template dashboard 2',
              slug: 'test-template-dashboard-2',
              downloads: 100,
              datasource: 'grafana-testdata-datasource',
            },
          ],
        });
      })
    );
  });

  afterEach(() => {
    contextSrv.user.permissions = originalPermissions;
  });

  describe('Render conditions', () => {
    it('should show TemplateDashboard modal when query param is present, test data source is available and there are template dashboards', async () => {
      render(<TemplateDashboardModal />, {
        historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
      });
      expect(await screen.findByRole('dialog', { name: 'Start a dashboard from a template' })).toBeInTheDocument();
    });

    it('should not show TemplateDashboard modal when query param is present but test data source is not available', async () => {
      mockUseDataSourceInstanceList.mockReturnValue({ isLoading: false, items: [] });
      render(<TemplateDashboardModal />, {
        historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
      });
      expect(screen.queryByRole('dialog', { name: 'Start a dashboard from a template' })).not.toBeInTheDocument();
    });

    it('renders an empty state in the Grafana templates tab when there are no template dashboards', async () => {
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

      // The modal still renders, but the Grafana tab shows an empty state instead of cards.
      expect(await screen.findByRole('dialog', { name: 'Start a dashboard from a template' })).toBeInTheDocument();
      expect(await screen.findByText('No template dashboards found')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
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
        screen.getByText('Get started with Grafana templates. Connect your data to power them with real metrics.')
      ).toBeInTheDocument();
    });
    it('should show template dashboard cards', async () => {
      render(<TemplateDashboardModal />, {
        historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
      });

      await waitFor(() => {
        // Assert DashboardCard components are rendered by checking for their headings
        const cardHeadings = screen.getAllByRole('heading', { level: 3 });
        expect(cardHeadings).toHaveLength(2);
        expect(cardHeadings[0]).toHaveTextContent('Test Template Dashboard');
        expect(cardHeadings[1]).toHaveTextContent('Test Template Dashboard 2');

        // Assert DashboardCard components are rendered by checking for "View template" buttons
        const viewTemplateButtons = screen.getAllByRole('button', { name: /^View template:/i });
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
          const cardHeadings = screen.getAllByRole('heading', { level: 3 });
          expect(cardHeadings).toHaveLength(2);
          expect(cardHeadings[0]).toHaveTextContent('Test Template Dashboard');
          expect(cardHeadings[1]).toHaveTextContent('Test Template Dashboard 2');
        });

        expect(screen.queryByRole('button', { name: /Customize with Assistant/i })).not.toBeInTheDocument();
      });

      it('should not render Customize with Assistant button when dashboardTemplatesAssistantButton is false', async () => {
        setTestFlags({ dashboardTemplatesAssistantButton: false, 'assistant.frontend.tools.dashboardTemplates': true });

        render(<TemplateDashboardModal />, {
          historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
        });

        await waitFor(() => {
          const cardHeadings = screen.getAllByRole('heading', { level: 3 });
          expect(cardHeadings).toHaveLength(2);
          expect(cardHeadings[0]).toHaveTextContent('Test Template Dashboard');
          expect(cardHeadings[1]).toHaveTextContent('Test Template Dashboard 2');
        });

        expect(screen.queryByRole('button', { name: /Customize with Assistant/i })).not.toBeInTheDocument();
      });

      it('should not render Customize with Assistant button when assistant.frontend.tools.dashboardTemplates is false', async () => {
        setTestFlags({ dashboardTemplatesAssistantButton: true, 'assistant.frontend.tools.dashboardTemplates': false });

        render(<TemplateDashboardModal />, {
          historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
        });

        await waitFor(() => {
          const cardHeadings = screen.getAllByRole('heading', { level: 3 });
          expect(cardHeadings).toHaveLength(2);
          expect(cardHeadings[0]).toHaveTextContent('Test Template Dashboard');
          expect(cardHeadings[1]).toHaveTextContent('Test Template Dashboard 2');
        });

        expect(screen.queryByRole('button', { name: /Customize with Assistant/i })).not.toBeInTheDocument();
      });
    });

    describe('when feature flags are enabled', () => {
      beforeEach(() => {
        setTestFlags({
          dashboardTemplatesAssistantButton: true,
          'assistant.frontend.tools.dashboardTemplates': true,
          analyticsFramework: false,
        });
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
      setTestFlags({ analyticsFramework: false });
      const { user } = render(<TemplateDashboardModal />, {
        historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
      });

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /^View template:/i })).toHaveLength(2);
      });

      await user.click(screen.getAllByRole('button', { name: /^View template:/i })[0]);

      expect(mockItemClicked).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'view_template',
        })
      );
    });
  });

  describe('when analyticsFramework flag is enabled', () => {
    it('should track action assistant with new analytics framework when Customize with Assistant is clicked', async () => {
      setTestFlags({
        dashboardTemplatesAssistantButton: true,
        'assistant.frontend.tools.dashboardTemplates': true,
        analyticsFramework: true,
      });
      const { user } = render(<TemplateDashboardModal />, {
        historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
      });

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /Customize with Assistant/i })).toHaveLength(2);
      });

      await user.click(screen.getAllByRole('button', { name: /Customize with Assistant/i })[0]);

      expect(mockNewItemClicked).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'assistant',
        })
      );
    });
  });
  it('view template button should track action view_template with new analytics framework when View template is clicked', async () => {
    setTestFlags({ analyticsFramework: true });
    const { user } = render(<TemplateDashboardModal />, {
      historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
    });

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^View template:/i })).toHaveLength(2);
    });

    await user.click(screen.getAllByRole('button', { name: /^View template:/i })[0]);

    expect(mockNewItemClicked).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'view_template',
      })
    );
  });

  describe('Custom templates tab', () => {
    describe('when the grafana.customDashboardTemplates flag is enabled and the extension is registered', () => {
      beforeEach(() => {
        mockGetDashboardTemplatesTab.mockReturnValue(MockCustomTemplatesTab);
        setTestFlags({ 'grafana.customDashboardTemplates': true });
      });

      it('renders both Custom and Grafana-provisioned tabs when grafana templates are available', async () => {
        render(<TemplateDashboardModal />, {
          historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
        });

        await screen.findByRole('dialog', { name: 'Start a dashboard from a template' });

        expect(screen.getByRole('tab', { name: 'Custom templates' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Grafana-provisioned' })).toBeInTheDocument();
      });

      it('defaults to the Custom tab and renders its content', async () => {
        render(<TemplateDashboardModal />, {
          historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
        });

        expect(await screen.findByTestId('custom-templates-tab')).toBeInTheDocument();
        // Grafana cards should not be visible while Custom tab is active
        expect(screen.queryByRole('heading', { level: 3, name: 'Test Template Dashboard' })).not.toBeInTheDocument();
      });

      it('shows the custom-tab description text by default', async () => {
        render(<TemplateDashboardModal />, {
          historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
        });

        expect(
          await screen.findByText('Get started with templates. Connect your data to power them with real metrics.')
        ).toBeInTheDocument();
      });

      it('switches to the Grafana-provisioned tab when clicked', async () => {
        const { user } = render(<TemplateDashboardModal />, {
          historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
        });

        await screen.findByTestId('custom-templates-tab');

        await user.click(screen.getByRole('tab', { name: 'Grafana-provisioned' }));

        await waitFor(() => {
          const cardHeadings = screen.getAllByRole('heading', { level: 3 });
          expect(cardHeadings).toHaveLength(2);
          expect(cardHeadings[0]).toHaveTextContent('Test Template Dashboard');
        });
        expect(screen.queryByTestId('custom-templates-tab')).not.toBeInTheDocument();
      });
    });

    describe('when the grafana.customDashboardTemplates flag is disabled', () => {
      beforeEach(() => {
        mockGetDashboardTemplatesTab.mockReturnValue(MockCustomTemplatesTab);
        setTestFlags({ 'grafana.customDashboardTemplates': false });
      });

      it('does not render the Custom tab even when the extension is registered', async () => {
        render(<TemplateDashboardModal />, {
          historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
        });

        await screen.findByRole('dialog', { name: 'Start a dashboard from a template' });

        expect(screen.queryByRole('tab', { name: 'Custom templates' })).not.toBeInTheDocument();
        expect(screen.queryByTestId('custom-templates-tab')).not.toBeInTheDocument();
      });
    });

    describe('when the extension is not registered', () => {
      beforeEach(() => {
        mockGetDashboardTemplatesTab.mockReturnValue(null);
        setTestFlags({ 'grafana.customDashboardTemplates': true });
      });

      it('does not render the Custom tab even when the feature flag is enabled', async () => {
        render(<TemplateDashboardModal />, {
          historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
        });

        await screen.findByRole('dialog', { name: 'Start a dashboard from a template' });

        expect(screen.queryByRole('tab', { name: 'Custom templates' })).not.toBeInTheDocument();
        expect(screen.queryByTestId('custom-templates-tab')).not.toBeInTheDocument();
      });
    });

    describe('when the user lacks the dashboardtemplates:read permission', () => {
      beforeEach(() => {
        mockGetDashboardTemplatesTab.mockReturnValue(MockCustomTemplatesTab);
        setTestFlags({ 'grafana.customDashboardTemplates': true });
        contextSrv.user.permissions = {};
      });

      it('does not render the Custom tab even when the extension is registered', async () => {
        render(<TemplateDashboardModal />, {
          historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
        });

        // Grafana-provisioned templates are still available, so the modal opens.
        await screen.findByRole('dialog', { name: 'Start a dashboard from a template' });

        expect(screen.queryByRole('tab', { name: 'Custom templates' })).not.toBeInTheDocument();
        expect(screen.queryByTestId('custom-templates-tab')).not.toBeInTheDocument();
      });
    });
  });

  describe('Grafana templates loaded tracking', () => {
    it('fires loaded once on open when the Grafana tab is the only view', async () => {
      setTestFlags({ analyticsFramework: false });
      render(<TemplateDashboardModal />, {
        historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
      });

      await waitFor(() => {
        expect(mockLoaded).toHaveBeenCalledTimes(1);
      });
      expect(mockNewLoaded).not.toHaveBeenCalled();
    });

    describe('with the custom templates tab registered', () => {
      beforeEach(() => {
        mockGetDashboardTemplatesTab.mockReturnValue(MockCustomTemplatesTab);
        setTestFlags({ 'grafana.customDashboardTemplates': true, analyticsFramework: false });
      });

      it('does not fire loaded on open while the Custom tab is the active (default) view', async () => {
        render(<TemplateDashboardModal />, {
          historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
        });

        // Wait for the gnet fetch to resolve (tabs become available) so we know the
        // loaded effect had a chance to run had it been wired to modal open.
        await screen.findByRole('tab', { name: 'Grafana-provisioned' });

        expect(mockLoaded).not.toHaveBeenCalled();
        expect(mockNewLoaded).not.toHaveBeenCalled();
      });

      it('fires loaded once when the user selects the Grafana tab, and not again on toggle', async () => {
        const { user } = render(<TemplateDashboardModal />, {
          historyOptions: { initialEntries: [`/dashboards?templateDashboards=true`] },
        });

        await screen.findByTestId('custom-templates-tab');

        // Select the Grafana-provisioned tab -> fires loaded once.
        await user.click(screen.getByRole('tab', { name: 'Grafana-provisioned' }));
        await waitFor(() => {
          expect(mockLoaded).toHaveBeenCalledTimes(1);
        });

        // Grafana -> Custom -> Grafana must not fire a second loaded event.
        await user.click(screen.getByRole('tab', { name: 'Custom templates' }));
        await screen.findByTestId('custom-templates-tab');
        await user.click(screen.getByRole('tab', { name: 'Grafana-provisioned' }));

        await waitFor(() => {
          expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
        });
        expect(mockLoaded).toHaveBeenCalledTimes(1);
      });
    });
  });
});
