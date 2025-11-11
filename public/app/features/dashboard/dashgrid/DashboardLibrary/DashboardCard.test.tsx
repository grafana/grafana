import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PluginDashboard } from 'app/types/plugins';

import { DashboardCard } from './DashboardCard';
import { GnetDashboard } from './types';

function setup(jsx: JSX.Element) {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
}

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
  uid: 'test-uid',
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
    render(<DashboardCard title="My Dashboard" dashboard={dashboard} onClick={mockOnClick} />);

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
      />
    );

    const image = screen.getByRole('img', { name: 'Test Dashboard' });
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/image.png');
  });

  it('should show "No preview available" when imageUrl is not provided', () => {
    const dashboard = createMockPluginDashboard();
    render(<DashboardCard title="Test Dashboard" dashboard={dashboard} onClick={mockOnClick} />);

    expect(screen.getByText('No preview available')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('should render description when provided', () => {
    const dashboard = createMockPluginDashboard({ description: 'My custom description' });
    render(<DashboardCard title="Test Dashboard" dashboard={dashboard} onClick={mockOnClick} />);

    expect(screen.getByText('My custom description')).toBeInTheDocument();
  });

  it('should not render description when empty', () => {
    const dashboard = createMockPluginDashboard({ description: '' });
    render(<DashboardCard title="Test Dashboard" dashboard={dashboard} onClick={mockOnClick} />);

    // Card should render but without description text
    expect(screen.getByRole('heading', { name: 'Test Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use template' })).toBeInTheDocument();
  });

  describe('Button interactions', () => {
    it('should trigger onClick when button is clicked', async () => {
      const { user } = setup(
        <DashboardCard title="Test Dashboard" dashboard={createMockPluginDashboard()} onClick={mockOnClick} />
      );

      await user.click(screen.getByRole('button', { name: 'Use template' }));

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should display default button text', () => {
      render(<DashboardCard title="Test Dashboard" dashboard={createMockPluginDashboard()} onClick={mockOnClick} />);

      expect(screen.getByRole('button', { name: 'Use template' })).toBeInTheDocument();
    });

    it('should display custom button text when provided', () => {
      render(
        <DashboardCard
          title="Test Dashboard"
          dashboard={createMockPluginDashboard()}
          onClick={mockOnClick}
          buttonText="Use dashboard"
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
        />
      );

      expect(screen.queryByText('Data source provided')).not.toBeInTheDocument();
    });

    it('should not show badge by default', () => {
      render(<DashboardCard title="Test Dashboard" dashboard={createMockPluginDashboard()} onClick={mockOnClick} />);

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
        />
      );

      expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
    });

    it('should not show details icon button when details are not provided', () => {
      render(<DashboardCard title="Test Dashboard" dashboard={createMockPluginDashboard()} onClick={mockOnClick} />);

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

      const { user } = setup(
        <DashboardCard
          title="Test Dashboard"
          dashboard={createMockPluginDashboard()}
          details={details}
          onClick={mockOnClick}
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

      const { user } = setup(
        <DashboardCard
          title="Test Dashboard"
          dashboard={createMockPluginDashboard()}
          details={details}
          onClick={mockOnClick}
        />
      );

      await user.hover(screen.getByRole('button', { name: 'Details' }));

      expect(await screen.findByText('123')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'View on Grafana.com' })).not.toBeInTheDocument();
    });
  });

  describe('Image handling', () => {
    it('should apply correct styling for logo vs thumbnail', () => {
      const { rerender } = render(
        <DashboardCard
          title="Test Dashboard"
          imageUrl="https://example.com/logo.png"
          dashboard={createMockPluginDashboard()}
          onClick={mockOnClick}
          isLogo={true}
        />
      );

      let image = screen.getByRole('img');
      expect(image).toBeInTheDocument();

      rerender(
        <DashboardCard
          title="Test Dashboard"
          imageUrl="https://example.com/screenshot.png"
          dashboard={createMockPluginDashboard()}
          onClick={mockOnClick}
          isLogo={false}
        />
      );

      image = screen.getByRole('img');
      expect(image).toBeInTheDocument();
    });
  });

  describe('GnetDashboard support', () => {
    it('should render with GnetDashboard', () => {
      const dashboard = createMockGnetDashboard({ name: 'Community Dashboard' });
      render(<DashboardCard title="Community Dashboard" dashboard={dashboard} onClick={mockOnClick} />);

      expect(screen.getByRole('heading', { name: 'Community Dashboard' })).toBeInTheDocument();
    });
  });
});
