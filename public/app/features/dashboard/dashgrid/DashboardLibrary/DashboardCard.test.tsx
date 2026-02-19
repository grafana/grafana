import { screen } from '@testing-library/react';
import { render, testWithFeatureToggles } from 'test/test-utils';

import { DashboardCard } from './DashboardCard';
import { createMockGnetDashboard, createMockPluginDashboard } from './utils/test-utils';

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

  describe('Compatibility badge', () => {
    testWithFeatureToggles({ enable: ['dashboardValidatorApp'] });

    it('should show Check button when showCompatibilityBadge={true} and onCompatibilityCheck is provided', () => {
      const mockOnCompatibilityCheck = jest.fn();
      render(
        <DashboardCard
          title="Test Dashboard"
          dashboard={createMockPluginDashboard()}
          onClick={mockOnClick}
          showCompatibilityBadge={true}
          onCompatibilityCheck={mockOnCompatibilityCheck}
          kind="suggested_dashboard"
        />
      );

      expect(screen.getByRole('button', { name: 'Check compatibility' })).toBeInTheDocument();
    });

    it('should not show compatibility badge when showCompatibilityBadge={false}', () => {
      const mockOnCompatibilityCheck = jest.fn();
      render(
        <DashboardCard
          title="Test Dashboard"
          dashboard={createMockPluginDashboard()}
          onClick={mockOnClick}
          showCompatibilityBadge={false}
          onCompatibilityCheck={mockOnCompatibilityCheck}
          kind="suggested_dashboard"
        />
      );

      expect(screen.queryByRole('button', { name: 'Check compatibility' })).not.toBeInTheDocument();
    });

    it('should not show compatibility badge when onCompatibilityCheck is not provided', () => {
      render(
        <DashboardCard
          title="Test Dashboard"
          dashboard={createMockPluginDashboard()}
          onClick={mockOnClick}
          showCompatibilityBadge={true}
          kind="suggested_dashboard"
        />
      );

      expect(screen.queryByRole('button', { name: 'Check compatibility' })).not.toBeInTheDocument();
    });

    it('should call onCompatibilityCheck when Check button is clicked', async () => {
      const mockOnCompatibilityCheck = jest.fn();
      const { user } = render(
        <DashboardCard
          title="Test Dashboard"
          dashboard={createMockPluginDashboard()}
          onClick={mockOnClick}
          showCompatibilityBadge={true}
          onCompatibilityCheck={mockOnCompatibilityCheck}
          kind="suggested_dashboard"
        />
      );

      await user.click(screen.getByRole('button', { name: 'Check compatibility' }));

      expect(mockOnCompatibilityCheck).toHaveBeenCalledTimes(1);
    });

    it('should prevent event propagation when Check button is clicked', async () => {
      const mockOnCompatibilityCheck = jest.fn();
      const mockParentClick = jest.fn();
      const { user } = render(
        <div onClick={mockParentClick}>
          <DashboardCard
            title="Test Dashboard"
            dashboard={createMockPluginDashboard()}
            onClick={mockOnClick}
            showCompatibilityBadge={true}
            onCompatibilityCheck={mockOnCompatibilityCheck}
            kind="suggested_dashboard"
          />
        </div>
      );

      await user.click(screen.getByRole('button', { name: 'Check compatibility' }));

      expect(mockParentClick).not.toHaveBeenCalled();
      expect(mockOnCompatibilityCheck).toHaveBeenCalledTimes(1);
    });

    it('should show success badge with score when compatibilityState has success status', () => {
      render(
        <DashboardCard
          title="Test Dashboard"
          dashboard={createMockPluginDashboard()}
          onClick={mockOnClick}
          showCompatibilityBadge={true}
          onCompatibilityCheck={jest.fn()}
          compatibilityState={{ status: 'success', score: 85, metricsFound: 17, metricsTotal: 20 }}
          kind="suggested_dashboard"
        />
      );

      expect(screen.getByTestId('compatibility-badge-success')).toBeInTheDocument();
      expect(screen.getByText('85% compatible')).toBeInTheDocument();
    });

    it('should show loading state when compatibilityState has loading status', () => {
      render(
        <DashboardCard
          title="Test Dashboard"
          dashboard={createMockPluginDashboard()}
          onClick={mockOnClick}
          showCompatibilityBadge={true}
          onCompatibilityCheck={jest.fn()}
          compatibilityState={{ status: 'loading' }}
          kind="suggested_dashboard"
        />
      );

      expect(screen.getByTestId('compatibility-badge-loading')).toBeInTheDocument();
    });

    it('should render buttons in correct order: details (in title), primary, compatibility badge', () => {
      const details = createMockDetails();
      render(
        <DashboardCard
          title="Test Dashboard"
          dashboard={createMockPluginDashboard()}
          onClick={mockOnClick}
          details={details}
          showCompatibilityBadge={true}
          onCompatibilityCheck={jest.fn()}
          kind="suggested_dashboard"
        />
      );

      // With dashboardValidatorApp enabled, details button moves into the title row
      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toHaveAttribute('aria-label', 'Details');
      expect(buttons[1]).toHaveTextContent('Use dashboard');
      expect(buttons[2]).toHaveTextContent('Check compatibility');
    });
  });

  describe('dashboardValidatorApp Feature Flag Gating', () => {
    describe('when dashboardValidatorApp is disabled', () => {
      testWithFeatureToggles({ disable: ['dashboardValidatorApp'] });

      it('should hide compatibility badge even when showCompatibilityBadge is true', () => {
        const mockOnCompatibilityCheck = jest.fn();

        render(
          <DashboardCard
            title="Test Dashboard"
            dashboard={createMockPluginDashboard()}
            onClick={jest.fn()}
            showCompatibilityBadge={true}
            onCompatibilityCheck={mockOnCompatibilityCheck}
            kind="suggested_dashboard"
          />
        );

        expect(screen.queryByRole('button', { name: /Check/i })).not.toBeInTheDocument();
      });
    });

    describe('when dashboardValidatorApp is enabled', () => {
      testWithFeatureToggles({ enable: ['dashboardValidatorApp'] });

      it('should show compatibility badge when showCompatibilityBadge is true', () => {
        const mockOnCompatibilityCheck = jest.fn();

        render(
          <DashboardCard
            title="Test Dashboard"
            dashboard={createMockPluginDashboard()}
            onClick={jest.fn()}
            showCompatibilityBadge={true}
            onCompatibilityCheck={mockOnCompatibilityCheck}
            kind="suggested_dashboard"
          />
        );

        expect(screen.getByRole('button', { name: /Check/i })).toBeInTheDocument();
      });
    });
  });
});
