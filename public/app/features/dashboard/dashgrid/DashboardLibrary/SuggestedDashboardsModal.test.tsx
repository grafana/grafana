import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { setDataSourceSrv } from '@grafana/runtime';
import { DashboardJson } from 'app/features/manage-dashboards/types';

import { SuggestedDashboardsModal } from './SuggestedDashboardsModal';
import { CONTENT_KINDS, EVENT_LOCATIONS } from './constants';
import { createMockGnetDashboard, createMockPluginDashboard } from './utils/test-utils';

jest.mock('./DashboardLibrarySection', () => ({
  DashboardLibrarySection: () => <div data-testid="dashboard-library-section">Dashboard Library Section</div>,
}));

jest.mock('./CommunityDashboardSection', () => ({
  CommunityDashboardSection: () => <div data-testid="community-dashboard-section">Community Dashboard Section</div>,
}));

jest.mock('./CommunityDashboardMappingForm', () => ({
  CommunityDashboardMappingForm: () => (
    <div data-testid="community-dashboard-mapping-form">Community Dashboard Mapping Form</div>
  ),
}));

describe('SuggestedDashboardsModal', () => {
  const defaultProps = {
    isOpen: true,
    onDismiss: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render when isOpen is true', () => {
    render(<SuggestedDashboardsModal {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should not render when isOpen is false', () => {
    render(<SuggestedDashboardsModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render both tabs: Data-source provided and Community', () => {
    render(<SuggestedDashboardsModal {...defaultProps} />);

    expect(screen.getByRole('tab', { name: 'Data-source provided' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Community' })).toBeInTheDocument();
  });

  it('should render tablist with both tabs', () => {
    render(<SuggestedDashboardsModal {...defaultProps} />);

    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveTextContent('Data-source provided');
    expect(tabs[1]).toHaveTextContent('Community');
  });

  it('should render DashboardLibrarySection when activeView is datasource', () => {
    render(<SuggestedDashboardsModal {...defaultProps} />);

    expect(screen.getByTestId('dashboard-library-section')).toBeInTheDocument();
    expect(screen.queryByTestId('community-dashboard-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('community-dashboard-mapping-form')).not.toBeInTheDocument();
  });

  it('should render CommunityDashboardSection when activeView is community', () => {
    render(
      <SuggestedDashboardsModal
        {...defaultProps}
        communityDashboards={[createMockGnetDashboard()]}
      />
    );

    expect(screen.getByTestId('community-dashboard-section')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-library-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('community-dashboard-mapping-form')).not.toBeInTheDocument();
  });

  it('should render CommunityDashboardMappingForm when activeView is mapping', () => {
    render(
      <SuggestedDashboardsModal
        {...defaultProps}
        initialMappingContext={{
          dashboardName: 'Test Dashboard',
          dashboardJson: { title: 'Test Dashboard', panels: [], schemaVersion: 41 } as DashboardJson,
          unmappedDsInputs: [],
          constantInputs: [],
          existingMappings: [],
          onInterpolateAndNavigate: jest.fn(),
          eventLocation: EVENT_LOCATIONS.MODAL_COMMUNITY_TAB,
          contentKind: CONTENT_KINDS.COMMUNITY_DASHBOARD,
        }}
      />
    );

    expect(screen.getByTestId('community-dashboard-mapping-form')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-library-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('community-dashboard-section')).not.toBeInTheDocument();
  });

  describe('default tab selection', () => {
    it('should default to datasource tab when both provisioned and community dashboards are provided', () => {
      render(
        <SuggestedDashboardsModal
          {...defaultProps}
          provisionedDashboards={[createMockPluginDashboard()]}
          communityDashboards={[createMockGnetDashboard()]}
        />
      );

      expect(screen.getByTestId('dashboard-library-section')).toBeInTheDocument();
      expect(screen.queryByTestId('community-dashboard-section')).not.toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Data-source provided' })).toHaveAttribute('aria-selected', 'true');
    });

    it('should default to datasource tab when only provisioned dashboards are provided', () => {
      render(
        <SuggestedDashboardsModal
          {...defaultProps}
          provisionedDashboards={[createMockPluginDashboard()]}
        />
      );

      expect(screen.getByTestId('dashboard-library-section')).toBeInTheDocument();
      expect(screen.queryByTestId('community-dashboard-section')).not.toBeInTheDocument();
    });

    it('should default to community tab when only community dashboards are provided', () => {
      render(
        <SuggestedDashboardsModal
          {...defaultProps}
          communityDashboards={[createMockGnetDashboard()]}
        />
      );

      expect(screen.getByTestId('community-dashboard-section')).toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-library-section')).not.toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Community' })).toHaveAttribute('aria-selected', 'true');
    });

    it('should default to datasource tab when no dashboards are provided', () => {
      render(<SuggestedDashboardsModal {...defaultProps} />);

      expect(screen.getByTestId('dashboard-library-section')).toBeInTheDocument();
      expect(screen.queryByTestId('community-dashboard-section')).not.toBeInTheDocument();
    });
  });

  describe('tab switching', () => {
    it('should switch from datasource to community tab when community tab is clicked', async () => {
      const { user } = render(
        <SuggestedDashboardsModal
          {...defaultProps}
          provisionedDashboards={[createMockPluginDashboard()]}
          communityDashboards={[createMockGnetDashboard()]}
        />
      );

      expect(screen.getByTestId('dashboard-library-section')).toBeInTheDocument();

      await user.click(screen.getByRole('tab', { name: 'Community' }));

      expect(screen.getByTestId('community-dashboard-section')).toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-library-section')).not.toBeInTheDocument();
    });

    it('should switch from community to datasource tab when datasource tab is clicked', async () => {
      const { user } = render(
        <SuggestedDashboardsModal
          {...defaultProps}
          communityDashboards={[createMockGnetDashboard()]}
        />
      );

      expect(screen.getByTestId('community-dashboard-section')).toBeInTheDocument();

      await user.click(screen.getByRole('tab', { name: 'Data-source provided' }));

      expect(screen.getByTestId('dashboard-library-section')).toBeInTheDocument();
      expect(screen.queryByTestId('community-dashboard-section')).not.toBeInTheDocument();
    });
  });

  describe('tabs visibility in mapping view', () => {
    it('should hide tabs when in mapping view', () => {
      render(
        <SuggestedDashboardsModal
          {...defaultProps}
          initialMappingContext={{
            dashboardName: 'Mapping Dashboard',
            dashboardJson: { title: 'Mapping Dashboard', panels: [], schemaVersion: 41 } as DashboardJson,
            unmappedDsInputs: [],
            constantInputs: [],
            existingMappings: [],
            onInterpolateAndNavigate: jest.fn(),
            eventLocation: EVENT_LOCATIONS.MODAL_COMMUNITY_TAB,
            contentKind: CONTENT_KINDS.COMMUNITY_DASHBOARD,
          }}
        />
      );

      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'Data-source provided' })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'Community' })).not.toBeInTheDocument();
    });
  });

  describe('modal title', () => {
    it('should show generic title when no datasource is provided', () => {
      render(<SuggestedDashboardsModal {...defaultProps} />);

      expect(screen.getByText('Suggested dashboards')).toBeInTheDocument();
    });

    it('should show datasource-specific title when datasourceUid is provided', () => {
      setDataSourceSrv({
        getInstanceSettings: () =>
          ({ uid: 'prom-uid', name: 'Prometheus', type: 'prometheus' }) as ReturnType<
            import('@grafana/runtime').DataSourceSrv['getInstanceSettings']
          >,
      } as import('@grafana/runtime').DataSourceSrv);

      render(<SuggestedDashboardsModal {...defaultProps} datasourceUid="prom-uid" />);

      expect(screen.getByText('Suggested dashboards for your prometheus datasource')).toBeInTheDocument();
    });

    it('should show mapping title with dashboard name when in mapping view', () => {
      render(
        <SuggestedDashboardsModal
          {...defaultProps}
          initialMappingContext={{
            dashboardName: 'My Custom Dashboard',
            dashboardJson: { title: 'My Custom Dashboard', panels: [], schemaVersion: 41 } as DashboardJson,
            unmappedDsInputs: [],
            constantInputs: [],
            existingMappings: [],
            onInterpolateAndNavigate: jest.fn(),
            eventLocation: EVENT_LOCATIONS.MODAL_COMMUNITY_TAB,
            contentKind: CONTENT_KINDS.COMMUNITY_DASHBOARD,
          }}
        />
      );

      expect(screen.getByText('Configure datasources for My Custom Dashboard')).toBeInTheDocument();
    });
  });
});
