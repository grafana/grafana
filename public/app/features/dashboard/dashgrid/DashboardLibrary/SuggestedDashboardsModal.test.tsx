import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { setDataSourceSrv } from '@grafana/runtime';
import { DashboardJson } from 'app/features/manage-dashboards/types';

import { SuggestedDashboardsModal } from './SuggestedDashboardsModal';
import { CONTENT_KINDS, EVENT_LOCATIONS } from './constants';
import { createMockGnetDashboard, createMockPluginDashboard } from './utils/test-utils';

jest.mock('./SuggestedDashboardsList/SuggestedDashboardsList', () => ({
  SuggestedDashboardsList: () => <div data-testid="suggested-dashboards-list">Suggested Dashboards List</div>,
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
    provisionedDashboards: [],
    communityDashboards: [],
    communityTotalPages: 0,
    isDashboardsLoading: false,
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

  it('should render SuggestedDashboardsList in list view', () => {
    render(<SuggestedDashboardsModal {...defaultProps} />);

    expect(screen.getByTestId('suggested-dashboards-list')).toBeInTheDocument();
    expect(screen.queryByTestId('community-dashboard-mapping-form')).not.toBeInTheDocument();
  });

  it('should not render tabs', () => {
    render(<SuggestedDashboardsModal {...defaultProps} />);

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
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
          eventLocation: EVENT_LOCATIONS.MODAL_MERGED_VIEW,
          contentKind: CONTENT_KINDS.COMMUNITY_DASHBOARD,
        }}
      />
    );

    expect(screen.getByTestId('community-dashboard-mapping-form')).toBeInTheDocument();
    expect(screen.queryByTestId('suggested-dashboards-list')).not.toBeInTheDocument();
  });

  it('should render SuggestedDashboardsList with both provisioned and community dashboards', () => {
    render(
      <SuggestedDashboardsModal
        {...defaultProps}
        provisionedDashboards={[createMockPluginDashboard()]}
        communityDashboards={[createMockGnetDashboard()]}
      />
    );

    expect(screen.getByTestId('suggested-dashboards-list')).toBeInTheDocument();
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
            eventLocation: EVENT_LOCATIONS.MODAL_MERGED_VIEW,
            contentKind: CONTENT_KINDS.COMMUNITY_DASHBOARD,
          }}
        />
      );

      expect(screen.getByText('Configure datasources for My Custom Dashboard')).toBeInTheDocument();
    });
  });
});
