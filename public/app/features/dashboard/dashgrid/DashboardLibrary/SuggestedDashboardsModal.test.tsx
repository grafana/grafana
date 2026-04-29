import { screen, act } from '@testing-library/react';
import { render } from 'test/test-utils';

import { setDataSourceSrv, type DataSourceSrv } from '@grafana/runtime';
import { type DashboardJson, InputType } from 'app/features/manage-dashboards/types';

import { type MappingContext, SuggestedDashboardsModal } from './SuggestedDashboardsModal';
import { CONTENT_KINDS } from './constants';
import { createMockGnetDashboard, createMockPluginDashboard } from './utils/test-utils';

let capturedOnShowMapping: ((context: MappingContext) => void) | null = null;

jest.mock('./SuggestedDashboardsList/SuggestedDashboardsList', () => ({
  SuggestedDashboardsList: ({ onShowMapping }: { onShowMapping: (context: MappingContext) => void }) => {
    capturedOnShowMapping = onShowMapping;
    return <div data-testid="suggested-dashboards-list">Suggested Dashboards List</div>;
  },
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
    capturedOnShowMapping = null;
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
            DataSourceSrv['getInstanceSettings']
          >,
      } as DataSourceSrv);

      render(<SuggestedDashboardsModal {...defaultProps} datasourceUid="prom-uid" />);

      expect(screen.getByText('Suggested dashboards for your prometheus datasource')).toBeInTheDocument();
    });
  });

  describe('CommunityDashboardMappingForm', () => {
    const mappingContext: MappingContext = {
      dashboardName: 'Test Dashboard',
      dashboardJson: { title: 'Test Dashboard', panels: [], schemaVersion: 41 } as DashboardJson,
      unmappedDsInputs: [],
      constantInputs: [],
      existingMappings: [],
      onInterpolateAndNavigate: jest.fn(),
      contentKind: CONTENT_KINDS.COMMUNITY_DASHBOARD,
    };

    it('should render CommunityDashboardMappingForm when activeView is mapping', () => {
      render(<SuggestedDashboardsModal {...defaultProps} initialMappingContext={mappingContext} />);

      expect(screen.getByTestId('community-dashboard-mapping-form')).toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-library-section')).not.toBeInTheDocument();
      expect(screen.queryByTestId('community-dashboard-section')).not.toBeInTheDocument();
    });

    it('should hide tabs when in mapping view', () => {
      render(
        <SuggestedDashboardsModal
          {...defaultProps}
          initialMappingContext={{
            ...mappingContext,
            dashboardName: 'Mapping Dashboard',
            dashboardJson: { title: 'Mapping Dashboard', panels: [], schemaVersion: 41 } as DashboardJson,
          }}
        />
      );

      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'Data-source provided' })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'Community' })).not.toBeInTheDocument();
    });

    it('should show mapping title with dashboard name when in mapping view', () => {
      render(
        <SuggestedDashboardsModal
          {...defaultProps}
          initialMappingContext={{
            ...mappingContext,
            dashboardName: 'My Custom Dashboard',
            dashboardJson: { title: 'My Custom Dashboard', panels: [], schemaVersion: 41 } as DashboardJson,
            unmappedDsInputs: [],
            constantInputs: [],
            existingMappings: [],
            onInterpolateAndNavigate: jest.fn(),
            contentKind: CONTENT_KINDS.COMMUNITY_DASHBOARD,
          }}
        />
      );

      expect(screen.getByText('Configure datasources for My Custom Dashboard')).toBeInTheDocument();
    });

    it('should switch from community tab to mapping form when onShowMapping is called', () => {
      render(<SuggestedDashboardsModal {...defaultProps} communityDashboards={[createMockGnetDashboard()]} />);

      expect(screen.getByTestId('suggested-dashboards-list')).toBeInTheDocument();
      expect(screen.queryByTestId('community-dashboard-mapping-form')).not.toBeInTheDocument();
      expect(capturedOnShowMapping).not.toBeNull();

      // Simulate CommunityDashboardSection calling onShowMapping (happens when a dashboard
      // needs mapping because unmappedDsInputs.length > 0 or constantInputs.length > 0)
      act(() => {
        capturedOnShowMapping!({
          dashboardName: 'Community Dashboard Needing Mapping',
          dashboardJson: {
            title: 'Community Dashboard Needing Mapping',
            panels: [],
            schemaVersion: 41,
          } as DashboardJson,
          unmappedDsInputs: [
            {
              name: 'DS_PROMETHEUS',
              label: 'Prometheus',
              info: 'Select a Prometheus datasource',
              value: '',
              type: InputType.DataSource,
              pluginId: 'prometheus',
            },
          ],
          constantInputs: [],
          existingMappings: [],
          onInterpolateAndNavigate: jest.fn(),
          contentKind: CONTENT_KINDS.COMMUNITY_DASHBOARD,
        });
      });

      // Mapping form should now be rendered
      expect(screen.getByTestId('community-dashboard-mapping-form')).toBeInTheDocument();
      // Community section should be gone
      expect(screen.queryByTestId('suggested-dashboards-list')).not.toBeInTheDocument();
      // Tabs should be hidden in mapping view
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    });
  });
});
