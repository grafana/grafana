import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';

import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { DashboardJson } from 'app/features/manage-dashboards/types';

import { CompatibilityModal } from './CompatibilityModal';
import { checkDashboardCompatibility, CompatibilityCheckResult } from './api/compatibilityApi';

// Mock dependencies
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
}));

jest.mock('./api/compatibilityApi', () => ({
  checkDashboardCompatibility: jest.fn(),
}));

const mockGetDataSourceSrv = getDataSourceSrv as jest.MockedFunction<typeof getDataSourceSrv>;
const mockCheckDashboardCompatibility = checkDashboardCompatibility as jest.MockedFunction<
  typeof checkDashboardCompatibility
>;

// Suppress console.error for expected errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalError;
});

// Prometheus-specific query type (extends DataQuery)
interface PrometheusQuery extends DataQuery {
  expr: string;
}

// Test fixtures
const createMockDashboard = (overrides: Partial<DashboardJson> = {}): DashboardJson => {
  // Create a minimal dashboard for testing purposes
  // Panels array is intentionally minimal - only includes fields needed for compatibility check
  const dashboard: DashboardJson = {
    title: 'Test Dashboard',
    uid: 'test-uid',
    schemaVersion: 39,
    version: 1,
    panels: [
      {
        id: 1,
        type: 'graph',
        title: 'CPU Usage',
        datasource: {
          type: 'prometheus',
          uid: 'prometheus-uid-123',
        },
        targets: [
          {
            refId: 'A',
            expr: 'rate(cpu_usage_total[5m])',
          } as PrometheusQuery,
        ],
      },
    ] as unknown as DashboardJson['panels'],
    ...overrides,
  };
  return dashboard;
};

const createMockCompatibilityResult = (score = 100): CompatibilityCheckResult => ({
  compatibilityScore: score,
  datasourceResults: [
    {
      uid: 'prometheus-uid',
      type: 'prometheus',
      name: 'Test Prometheus',
      totalQueries: 5,
      checkedQueries: 5,
      totalMetrics: 10,
      foundMetrics: score === 100 ? 10 : Math.floor(10 * (score / 100)),
      missingMetrics: score === 100 ? [] : ['missing_metric_1', 'missing_metric_2'],
      compatibilityScore: score,
      queryBreakdown: [],
    },
  ],
});

const defaultProps: ComponentProps<typeof CompatibilityModal> = {
  isOpen: true,
  onDismiss: jest.fn(),
  dashboardJson: createMockDashboard(),
  datasourceUid: 'prometheus-uid',
};

describe('CompatibilityModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock: datasource found
    mockGetDataSourceSrv.mockReturnValue({
      getInstanceSettings: jest.fn().mockReturnValue({
        uid: 'prometheus-uid',
        type: 'prometheus',
        name: 'Test Prometheus',
      }),
    } as unknown as ReturnType<typeof getDataSourceSrv>);

    // Default mock: successful API call
    mockCheckDashboardCompatibility.mockResolvedValue(createMockCompatibilityResult(100));
  });

  describe('Modal visibility', () => {
    it('should render modal when isOpen is true', async () => {
      render(<CompatibilityModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dashboard Compatibility Check for Test Dashboard')).toBeInTheDocument();
      });
    });

    it('should not render modal content when isOpen is false', async () => {
      render(<CompatibilityModal {...defaultProps} isOpen={false} />);

      // Wait for any async updates to settle
      await waitFor(() => {
        expect(screen.queryByText('Dashboard Compatibility Check for Test Dashboard')).not.toBeInTheDocument();
      });
    });

    it('should include dashboard title in modal title', async () => {
      const dashboardWithCustomTitle = createMockDashboard({ title: 'My Custom Dashboard' });
      render(<CompatibilityModal {...defaultProps} dashboardJson={dashboardWithCustomTitle} />);

      await waitFor(() => {
        expect(screen.getByText('Dashboard Compatibility Check for My Custom Dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Loading state', () => {
    it('should show loading spinner and message while checking compatibility', async () => {
      // Make API call pending
      mockCheckDashboardCompatibility.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(createMockCompatibilityResult(100)), 1000))
      );

      render(<CompatibilityModal {...defaultProps} />);

      // Should show loading state immediately
      expect(screen.getByText('Checking compatibility...')).toBeInTheDocument();
      expect(screen.getByTestId('Spinner')).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('should show error alert when dashboard is v2 schema', async () => {
      // Create a v2 dashboard (has 'elements' property instead of 'panels')
      const v2Dashboard = { elements: {}, schemaVersion: 40 } as unknown as DashboardJson;

      render(<CompatibilityModal {...defaultProps} dashboardJson={v2Dashboard} />);

      await waitFor(() => {
        expect(screen.getByText('Error checking compatibility')).toBeInTheDocument();
        expect(screen.getByText('Failed to check dashboard compatibility. Please try again.')).toBeInTheDocument();
      });

      // API should not be called for v2 dashboards
      expect(mockCheckDashboardCompatibility).not.toHaveBeenCalled();
    });

    it('should show error alert when datasource is not found', async () => {
      mockGetDataSourceSrv.mockReturnValue({
        getInstanceSettings: jest.fn().mockReturnValue(null),
      } as unknown as ReturnType<typeof getDataSourceSrv>);

      render(<CompatibilityModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Error checking compatibility')).toBeInTheDocument();
        expect(screen.getByText('Failed to check dashboard compatibility. Please try again.')).toBeInTheDocument();
      });
    });

    it('should show error alert when API call fails', async () => {
      mockCheckDashboardCompatibility.mockRejectedValue(new Error('API Error'));

      render(<CompatibilityModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Error checking compatibility')).toBeInTheDocument();
        expect(screen.getByText('Failed to check dashboard compatibility. Please try again.')).toBeInTheDocument();
      });
    });

    it('should show retry button in error state', async () => {
      mockCheckDashboardCompatibility.mockRejectedValue(new Error('API Error'));

      render(<CompatibilityModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should retry API call when retry button is clicked', async () => {
      const user = userEvent.setup();

      // First call fails
      mockCheckDashboardCompatibility.mockRejectedValueOnce(new Error('API Error'));
      // Second call succeeds
      mockCheckDashboardCompatibility.mockResolvedValueOnce(createMockCompatibilityResult(100));

      render(<CompatibilityModal {...defaultProps} />);

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText('Error checking compatibility')).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      // Should eventually show success state (loading may be too fast to catch)
      await waitFor(() => {
        expect(screen.getByText('Compatibility Score')).toBeInTheDocument();
        expect(screen.getByText('100%')).toBeInTheDocument();
      });

      // API should have been called twice
      expect(mockCheckDashboardCompatibility).toHaveBeenCalledTimes(2);
    });
  });

  describe('Success state', () => {
    it('should show compatibility score when check succeeds', async () => {
      mockCheckDashboardCompatibility.mockResolvedValue(createMockCompatibilityResult(100));

      render(<CompatibilityModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Compatibility Score')).toBeInTheDocument();
        expect(screen.getByText('100%')).toBeInTheDocument();
      });
    });

    it('should display partial compatibility score', async () => {
      mockCheckDashboardCompatibility.mockResolvedValue(createMockCompatibilityResult(75));

      render(<CompatibilityModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Compatibility Score')).toBeInTheDocument();
        expect(screen.getByText('75%')).toBeInTheDocument();
      });
    });

    it('should display low compatibility score', async () => {
      mockCheckDashboardCompatibility.mockResolvedValue(createMockCompatibilityResult(25));

      render(<CompatibilityModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Compatibility Score')).toBeInTheDocument();
        expect(screen.getByText('25%')).toBeInTheDocument();
      });
    });
  });

  describe('API call behavior', () => {
    it('should call checkDashboardCompatibility with correct parameters', async () => {
      const dashboardJson = createMockDashboard();
      render(<CompatibilityModal {...defaultProps} dashboardJson={dashboardJson} />);

      await waitFor(() => {
        expect(mockCheckDashboardCompatibility).toHaveBeenCalledWith(dashboardJson, [
          {
            uid: 'prometheus-uid',
            type: 'prometheus',
            name: 'Test Prometheus',
          },
        ]);
      });
    });

    it('should not call API when modal is closed', async () => {
      render(<CompatibilityModal {...defaultProps} isOpen={false} />);

      // Wait for any async updates to settle
      await waitFor(() => {
        expect(mockCheckDashboardCompatibility).not.toHaveBeenCalled();
      });
    });

    it('should trigger API call when modal opens', async () => {
      const { rerender } = render(<CompatibilityModal {...defaultProps} isOpen={false} />);

      // API should not be called yet
      expect(mockCheckDashboardCompatibility).not.toHaveBeenCalled();

      // Open modal
      rerender(<CompatibilityModal {...defaultProps} isOpen={true} />);

      // API should now be called
      await waitFor(() => {
        expect(mockCheckDashboardCompatibility).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Modal interactions', () => {
    it('should call onDismiss when modal is closed', async () => {
      const onDismiss = jest.fn();
      render(<CompatibilityModal {...defaultProps} onDismiss={onDismiss} />);

      // Wait for modal to render
      await waitFor(() => {
        expect(screen.getByText('Dashboard Compatibility Check for Test Dashboard')).toBeInTheDocument();
      });

      // Find and click close button (X button in modal header)
      const closeButton = screen.getByLabelText('Close');
      await userEvent.click(closeButton);

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });
});
