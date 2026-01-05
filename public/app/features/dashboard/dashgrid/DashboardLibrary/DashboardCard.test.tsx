import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { PluginDashboard } from 'app/types/plugins';

import { DashboardCard } from './DashboardCard';
import { GnetDashboard } from './types';

// Helper functions for creating mock objects
const createMockPluginDashboard = (overrides: Partial<PluginDashboard> = {}): PluginDashboard => ({
  dashboardId: 1,
  description: 'Test description',
  imported: false,
  importedRevision: 0,
  importedUri: '',
  importedUrl: '',
  path: '',
  pluginId: 'test-plugin',
  removed: false,
  revision: 1,
  slug: 'test-dashboard',
  title: 'Test Dashboard',
  uid: 'test-uid',
  ...overrides,
});

const createMockGnetDashboard = (overrides: Partial<GnetDashboard> = {}): GnetDashboard => ({
  id: 123,
  name: 'Test Dashboard',
  description: 'Test description',
  datasource: 'Prometheus',
  orgName: 'Test Org',
  userName: 'testuser',
  publishedAt: '',
  updatedAt: '',
  downloads: 0,
  ...overrides,
});

const createMockDetails = (overrides = {}) => ({
  id: '123',
  datasource: 'Prometheus',
  dependencies: ['Prometheus'],
  publishedBy: 'Test Org',
  lastUpdate: '1 Jan 2025',
  grafanaComUrl: 'https://grafana.com/grafana/dashboards/123-test/',
  ...overrides,
});

describe('DashboardCard', () => {
  const mockOnClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render title as heading', () => {
    const dashboard = createMockPluginDashboard();
    render(
      <DashboardCard title="My Dashboard" dashboard={dashboard} onClick={mockOnClick} kind="suggested_dashboard" />
    );

    expect(screen.getByRole('heading', { name: 'My Dashboard' })).toBeInTheDocument();
  });

  it('should render image when imageUrl is provided', () => {
    const dashboard = createMockPluginDashboard();
    render(
      <DashboardCard
        title="Test Dashboard"
        imageUrl="https://example.com/image.png"
        dashboard={dashboard}
        onClick={mockOnClick}
        kind="suggested_dashboard"
      />
    );

    const image = screen.getByRole('img', { name: 'Test Dashboard' });
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/image.png');
  });

  it('should show "No preview available" when imageUrl is not provided', () => {
    const dashboard = createMockPluginDashboard();
    render(
      <DashboardCard title="Test Dashboard" dashboard={dashboard} onClick={mockOnClick} kind="suggested_dashboard" />
    );

    expect(screen.getByText('No preview available')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('should render description when provided', () => {
    const dashboard = createMockPluginDashboard({ description: 'My custom description' });
    render(
      <DashboardCard title="Test Dashboard" dashboard={dashboard} onClick={mockOnClick} kind="suggested_dashboard" />
    );

    expect(screen.getByText('My custom description')).toBeInTheDocument();
  });

  it('should not render description when empty', () => {
    const dashboard = createMockPluginDashboard({ description: '' });
    render(
      <DashboardCard title="Test Dashboard" dashboard={dashboard} onClick={mockOnClick} kind="suggested_dashboard" />
    );

    expect(screen.getByRole('heading', { name: 'Test Dashboard' })).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-card-description')).not.toBeInTheDocument();
  });

  describe('Button interactions', () => {
    it('should trigger onClick when button is clicked', async () => {
      const { user } = render(
        <DashboardCard
          title="Test Dashboard"
          dashboard={createMockPluginDashboard()}
          onClick={mockOnClick}
          kind="suggested_dashboard"
        />
      );

      await user.click(screen.getByRole('button', { name: 'Use dashboard' }));

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should display template button text', () => {
      render(
        <DashboardCard
          title="Test Dashboard"
          dashboard={createMockPluginDashboard()}
          onClick={mockOnClick}
          kind="template_dashboard"
        />
      );

      expect(screen.getByRole('button', { name: 'Use template' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Use dashboard' })).not.toBeInTheDocument();
    });

    it('should display dashboard button text', () => {
      render(
        <DashboardCard
          title="Test Dashboard"
          dashboard={createMockPluginDashboard()}
          onClick={mockOnClick}
          kind="suggested_dashboard"
        />
      );

      expect(screen.getByRole('button', { name: 'Use dashboard' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Use template' })).not.toBeInTheDocument();
    });
  });

  describe('Badge display', () => {
    it('should show datasource-provided badge when flag is true', () => {
      render(
        <DashboardCard
          title="Test Dashboard"
          dashboard={createMockPluginDashboard()}
          onClick={mockOnClick}
          showDatasourceProvidedBadge={true}
          kind="suggested_dashboard"
        />
      );

      expect(screen.getByText('Data source provided')).toBeInTheDocument();
    });

    it('should not show badge when flag is false', () => {
      render(
        <DashboardCard
          title="Test Dashboard"
          dashboard={createMockPluginDashboard()}
          onClick={mockOnClick}
          showDatasourceProvidedBadge={false}
          kind="suggested_dashboard"
        />
      );

      expect(screen.queryByText('Data source provided')).not.toBeInTheDocument();
    });

    it('should not show badge by default', () => {
      render(
        <DashboardCard
          title="Test Dashboard"
          dashboard={createMockPluginDashboard()}
          onClick={mockOnClick}
          kind="suggested_dashboard"
        />
      );

      expect(screen.queryByText('Data source provided')).not.toBeInTheDocument();
    });
  });

  describe('Details tooltip', () => {
    it('should show details icon button when details are provided', () => {
      const details = createMockDetails();
      render(
        <DashboardCard
          title="Test Dashboard"
          dashboard={createMockPluginDashboard()}
          details={details}
          onClick={mockOnClick}
          kind="suggested_dashboard"
        />
      );

      expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
    });

    it('should not show details icon button when details are not provided', () => {
      render(
        <DashboardCard
          title="Test Dashboard"
          dashboard={createMockPluginDashboard()}
          onClick={mockOnClick}
          kind="suggested_dashboard"
        />
      );

      expect(screen.queryByRole('button', { name: 'Details' })).not.toBeInTheDocument();
    });

    it('should display details information in tooltip', async () => {
      const details = createMockDetails({
        id: '456',
        datasource: 'Loki',
        dependencies: ['Loki', 'Prometheus'],
        publishedBy: 'Grafana Labs',
        lastUpdate: '15 Dec 2024',
        grafanaComUrl: 'https://grafana.com/grafana/dashboards/456-loki/',
      });

      const { user } = render(
        <DashboardCard
          title="Test Dashboard"
          dashboard={createMockPluginDashboard()}
          details={details}
          onClick={mockOnClick}
          kind="suggested_dashboard"
        />
      );

      await user.hover(screen.getByRole('button', { name: 'Details' }));

      expect(await screen.findByText('456')).toBeInTheDocument();
      expect(screen.getByText('Loki')).toBeInTheDocument();
      expect(screen.getByText('Loki | Prometheus')).toBeInTheDocument();
      expect(screen.getByText('Grafana Labs')).toBeInTheDocument();
      expect(screen.getByText('15 Dec 2024')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'View on Grafana.com' })).toHaveAttribute(
        'href',
        'https://grafana.com/grafana/dashboards/456-loki/'
      );
    });

    it('should not show Grafana.com link when grafanaComUrl is not provided', async () => {
      const details = createMockDetails({ grafanaComUrl: undefined });

      const { user } = render(
        <DashboardCard
          title="Test Dashboard"
          dashboard={createMockPluginDashboard()}
          details={details}
          onClick={mockOnClick}
          kind="suggested_dashboard"
        />
      );

      await user.hover(screen.getByRole('button', { name: 'Details' }));

      expect(await screen.findByText('123')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'View on Grafana.com' })).not.toBeInTheDocument();
    });
  });

  describe('Image handling', () => {
    it('should render image correctly for logo vs thumbnail', () => {
      const { rerender } = render(
        <DashboardCard
          title="Test Dashboard"
          imageUrl="https://example.com/logo.png"
          dashboard={createMockPluginDashboard()}
          onClick={mockOnClick}
          isLogo={true}
          kind="suggested_dashboard"
        />
      );

      let image = screen.getByRole('img');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', 'https://example.com/logo.png');

      rerender(
        <DashboardCard
          title="Test Dashboard"
          imageUrl="https://example.com/screenshot.png"
          dashboard={createMockPluginDashboard()}
          onClick={mockOnClick}
          isLogo={false}
          kind="suggested_dashboard"
        />
      );

      image = screen.getByRole('img');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', 'https://example.com/screenshot.png');
    });

    it('should render image when dimThumbnail is true', () => {
      render(
        <DashboardCard
          title="Test Dashboard"
          imageUrl="https://example.com/screenshot.png"
          dashboard={createMockPluginDashboard()}
          onClick={mockOnClick}
          dimThumbnail={true}
          showDatasourceProvidedBadge={true}
          kind="suggested_dashboard"
        />
      );

      const image = screen.getByRole('img');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', 'https://example.com/screenshot.png');
    });
  });

  describe('GnetDashboard support', () => {
    it('should render with GnetDashboard', () => {
      const dashboard = createMockGnetDashboard({ name: 'Community Dashboard' });
      render(
        <DashboardCard
          title="Community Dashboard"
          dashboard={dashboard}
          onClick={mockOnClick}
          kind="suggested_dashboard"
        />
      );

      expect(screen.getByRole('heading', { name: 'Community Dashboard' })).toBeInTheDocument();
    });
  });
});
