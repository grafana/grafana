import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { DashboardJson } from 'app/features/manage-dashboards/types';

import { SuggestedDashboardsModal } from './SuggestedDashboardsModal';
import { CONTENT_KINDS, EVENT_LOCATIONS } from './interactions';

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
    render(<SuggestedDashboardsModal {...defaultProps} defaultTab="datasource" />);

    expect(screen.getByTestId('dashboard-library-section')).toBeInTheDocument();
    expect(screen.queryByTestId('community-dashboard-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('community-dashboard-mapping-form')).not.toBeInTheDocument();
  });

  it('should render CommunityDashboardSection when activeView is community', () => {
    render(<SuggestedDashboardsModal {...defaultProps} defaultTab="community" />);

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
});
