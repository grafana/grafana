import { act, render, screen, waitFor } from '@testing-library/react';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

import { PanelAnalyticsMetrics } from '../../dashboard/services/DashboardAnalyticsAggregator';
import * as DashboardProfiler from '../../dashboard/services/DashboardProfiler';
import { activateFullSceneTree } from '../utils/test-utils';

import { PanelPerformanceMetrics } from './PanelPerformanceMetrics';

// Set up plugin import utils (required for VizPanel activation)
setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  setPluginExtensionGetter: jest.fn(),
  getPluginLinkExtensions: jest.fn(() => ({
    extensions: [],
  })),
  getDataSourceSrv: () => {
    return {
      get: jest.fn().mockResolvedValue({
        getRef: () => ({ uid: 'ds1' }),
      }),
      getInstanceSettings: jest.fn().mockResolvedValue({ uid: 'ds1' }),
    };
  },
}));

// Mock the DashboardProfiler module
jest.mock('../../dashboard/services/DashboardProfiler', () => ({
  isPanelProfilingEnabled: jest.fn(),
}));

// Mock the DashboardAnalyticsAggregator
let storedCallback: ((metrics: PanelAnalyticsMetrics) => void) | null = null;
jest.mock('../../dashboard/services/DashboardAnalyticsAggregator', () => ({
  getDashboardAnalyticsAggregator: jest.fn(() => ({
    subscribeToPanelMetrics: jest.fn((panelId: string, callback: (metrics: PanelAnalyticsMetrics) => void) => {
      // Store callback for later use
      storedCallback = callback;
      return {
        unsubscribe: jest.fn(),
      };
    }),
  })),
}));

describe('PanelPerformanceMetrics', () => {
  let mockIsPanelProfilingEnabled: jest.MockedFunction<typeof DashboardProfiler.isPanelProfilingEnabled>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    storedCallback = null;
    mockIsPanelProfilingEnabled = DashboardProfiler.isPanelProfilingEnabled as jest.MockedFunction<
      typeof DashboardProfiler.isPanelProfilingEnabled
    >;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should render metrics when profiling is enabled', async () => {
    // Arrange: Enable profiling
    mockIsPanelProfilingEnabled.mockReturnValue(true);

    // Create a VizPanel with PanelPerformanceMetrics
    const panelMetrics = new PanelPerformanceMetrics();
    const vizPanel = new VizPanel({
      key: 'panel-1',
      title: 'Test Panel',
      pluginId: 'table',
      titleItems: [panelMetrics],
    });

    activateFullSceneTree(vizPanel);

    // Provide mock metrics
    const mockMetrics: PanelAnalyticsMetrics = {
      panelId: '1',
      panelKey: 'panel-1',
      pluginId: 'table',
      totalQueryTime: 100,
      totalFieldConfigTime: 10,
      totalTransformationTime: 20,
      totalRenderTime: 50,
      pluginLoadTime: 5,
      queryOperations: [{ duration: 100, timestamp: Date.now() }],
      fieldConfigOperations: [{ duration: 10, timestamp: Date.now() }],
      transformationOperations: [],
      renderOperations: [{ duration: 50, timestamp: Date.now() }],
    };

    // Act: Render the component
    const { rerender } = render(<panelMetrics.Component model={panelMetrics} />);

    // Wait for activation to complete and callback to be stored
    await waitFor(() => {
      expect(storedCallback).not.toBeNull();
    });

    // Trigger the callback with metrics
    await act(async () => {
      if (storedCallback) {
        storedCallback(mockMetrics);
      }
      // Advance timers to process setTimeout
      jest.advanceTimersByTime(10);
    });

    // Force rerender to see updated state
    await act(async () => {
      rerender(<panelMetrics.Component model={panelMetrics} />);
    });

    // Assert: Check that metrics are displayed
    await waitFor(() => {
      expect(screen.getByText(/Q:/)).toBeInTheDocument();
      expect(screen.getByText(/R:/)).toBeInTheDocument();
    });
  });

  it('should display correct metric values', async () => {
    // Arrange: Enable profiling
    mockIsPanelProfilingEnabled.mockReturnValue(true);

    const panelMetrics = new PanelPerformanceMetrics();
    const vizPanel = new VizPanel({
      key: 'panel-1',
      title: 'Test Panel',
      pluginId: 'table',
      titleItems: [panelMetrics],
    });

    activateFullSceneTree(vizPanel);

    // Provide mock metrics with specific values
    const mockMetrics: PanelAnalyticsMetrics = {
      panelId: '1',
      panelKey: 'panel-1',
      pluginId: 'table',
      totalQueryTime: 100,
      totalFieldConfigTime: 10,
      totalTransformationTime: 0,
      totalRenderTime: 50,
      pluginLoadTime: 5,
      queryOperations: [{ duration: 100, timestamp: Date.now() }],
      fieldConfigOperations: [],
      transformationOperations: [],
      renderOperations: [{ duration: 50, timestamp: Date.now() }],
    };

    // Act: Render the component
    const { rerender } = render(<panelMetrics.Component model={panelMetrics} />);

    // Wait for activation to complete and callback to be stored
    await waitFor(() => {
      expect(storedCallback).not.toBeNull();
    });

    // Trigger the callback with metrics
    await act(async () => {
      if (storedCallback) {
        storedCallback(mockMetrics);
      }
      // Advance timers to process setTimeout
      jest.advanceTimersByTime(10);
    });

    // Force rerender to see updated state
    await act(async () => {
      rerender(<panelMetrics.Component model={panelMetrics} />);
    });

    // Assert: Check that correct values are displayed
    await waitFor(() => {
      expect(screen.getByText(/Q:100ms/)).toBeInTheDocument();
      expect(screen.getByText(/R:50ms/)).toBeInTheDocument();
    });
  });

  it('should display correct metric values with transformations', async () => {
    // Arrange: Enable profiling
    mockIsPanelProfilingEnabled.mockReturnValue(true);

    const panelMetrics = new PanelPerformanceMetrics();
    const vizPanel = new VizPanel({
      key: 'panel-1',
      title: 'Test Panel',
      pluginId: 'table',
      titleItems: [panelMetrics],
    });

    activateFullSceneTree(vizPanel);

    // Provide mock metrics with transformations
    const mockMetrics: PanelAnalyticsMetrics = {
      panelId: '1',
      panelKey: 'panel-1',
      pluginId: 'table',
      totalQueryTime: 150,
      totalFieldConfigTime: 10,
      totalTransformationTime: 25,
      totalRenderTime: 75,
      pluginLoadTime: 5,
      queryOperations: [{ duration: 150, timestamp: Date.now() }],
      fieldConfigOperations: [],
      transformationOperations: [{ duration: 25, timestamp: Date.now() }],
      renderOperations: [{ duration: 75, timestamp: Date.now() }],
    };

    // Act: Render the component
    const { rerender } = render(<panelMetrics.Component model={panelMetrics} />);

    // Wait for activation to complete and callback to be stored
    await waitFor(() => {
      expect(storedCallback).not.toBeNull();
    });

    // Trigger the callback with metrics
    await act(async () => {
      if (storedCallback) {
        storedCallback(mockMetrics);
      }
      // Advance timers to process setTimeout
      jest.advanceTimersByTime(10);
    });

    // Force rerender to see updated state
    await act(async () => {
      rerender(<panelMetrics.Component model={panelMetrics} />);
    });

    // Assert: Check that correct values are displayed including transform
    await waitFor(() => {
      expect(screen.getByText(/Q:150ms/)).toBeInTheDocument();
      expect(screen.getByText(/T:25ms/)).toBeInTheDocument();
      expect(screen.getByText(/R:75ms/)).toBeInTheDocument();
    });
  });

  it('should format durations correctly (seconds for >= 1000ms)', async () => {
    // Arrange: Enable profiling
    mockIsPanelProfilingEnabled.mockReturnValue(true);

    const panelMetrics = new PanelPerformanceMetrics();
    const vizPanel = new VizPanel({
      key: 'panel-1',
      title: 'Test Panel',
      pluginId: 'table',
      titleItems: [panelMetrics],
    });

    activateFullSceneTree(vizPanel);

    // Provide mock metrics with values >= 1000ms
    const mockMetrics: PanelAnalyticsMetrics = {
      panelId: '1',
      panelKey: 'panel-1',
      pluginId: 'table',
      totalQueryTime: 2500,
      totalFieldConfigTime: 10,
      totalTransformationTime: 0,
      totalRenderTime: 1500,
      pluginLoadTime: 5,
      queryOperations: [{ duration: 2500, timestamp: Date.now() }],
      fieldConfigOperations: [],
      transformationOperations: [],
      renderOperations: [{ duration: 1500, timestamp: Date.now() }],
    };

    // Act: Render the component
    const { rerender } = render(<panelMetrics.Component model={panelMetrics} />);

    // Wait for activation to complete and callback to be stored
    await waitFor(() => {
      expect(storedCallback).not.toBeNull();
    });

    // Trigger the callback with metrics
    await act(async () => {
      if (storedCallback) {
        storedCallback(mockMetrics);
      }
      // Advance timers to process setTimeout
      jest.advanceTimersByTime(10);
    });

    // Force rerender to see updated state
    await act(async () => {
      rerender(<panelMetrics.Component model={panelMetrics} />);
    });

    // Assert: Check that values are formatted as seconds
    await waitFor(() => {
      expect(screen.getByText(/Q:2\.50s/)).toBeInTheDocument();
      expect(screen.getByText(/R:1\.50s/)).toBeInTheDocument();
    });
  });

  it('should not render when profiling is disabled', () => {
    // Arrange: Disable profiling
    mockIsPanelProfilingEnabled.mockReturnValue(false);

    // Create a VizPanel with PanelPerformanceMetrics
    const panelMetrics = new PanelPerformanceMetrics();
    const vizPanel = new VizPanel({
      key: 'panel-1',
      title: 'Test Panel',
      pluginId: 'table',
      titleItems: [panelMetrics],
    });

    activateFullSceneTree(vizPanel);

    // Act: Render the component
    const { container } = render(<panelMetrics.Component model={panelMetrics} />);

    // Assert: Component should not render anything
    expect(container.firstChild).toBeNull();
  });

  it('should show transform metric when transformations exist', async () => {
    // Arrange: Enable profiling
    mockIsPanelProfilingEnabled.mockReturnValue(true);

    const panelMetrics = new PanelPerformanceMetrics();
    const vizPanel = new VizPanel({
      key: 'panel-1',
      title: 'Test Panel',
      pluginId: 'table',
      titleItems: [panelMetrics],
    });

    activateFullSceneTree(vizPanel);

    // Provide mock metrics with transformations
    const mockMetrics: PanelAnalyticsMetrics = {
      panelId: '1',
      panelKey: 'panel-1',
      pluginId: 'table',
      totalQueryTime: 100,
      totalFieldConfigTime: 10,
      totalTransformationTime: 20,
      totalRenderTime: 50,
      pluginLoadTime: 5,
      queryOperations: [{ duration: 100, timestamp: Date.now() }],
      fieldConfigOperations: [],
      transformationOperations: [{ duration: 20, timestamp: Date.now() }],
      renderOperations: [{ duration: 50, timestamp: Date.now() }],
    };

    // Act: Render the component
    const { rerender } = render(<panelMetrics.Component model={panelMetrics} />);

    // Wait for activation to complete and callback to be stored
    await waitFor(() => {
      expect(storedCallback).not.toBeNull();
    });

    // Trigger the callback with metrics
    await act(async () => {
      if (storedCallback) {
        storedCallback(mockMetrics);
      }
      // Advance timers to process setTimeout
      jest.advanceTimersByTime(10);
    });

    // Force rerender to see updated state
    await act(async () => {
      rerender(<panelMetrics.Component model={panelMetrics} />);
    });

    // Assert: Transform metric should be displayed
    await waitFor(() => {
      expect(screen.getByText(/Q:/)).toBeInTheDocument();
      expect(screen.getByText(/T:/)).toBeInTheDocument();
      expect(screen.getByText(/R:/)).toBeInTheDocument();
    });
  });

  it('should not show transform metric when no transformations exist', async () => {
    // Arrange: Enable profiling
    mockIsPanelProfilingEnabled.mockReturnValue(true);

    const panelMetrics = new PanelPerformanceMetrics();
    const vizPanel = new VizPanel({
      key: 'panel-1',
      title: 'Test Panel',
      pluginId: 'table',
      titleItems: [panelMetrics],
    });

    activateFullSceneTree(vizPanel);

    // Provide mock metrics without transformations
    const mockMetrics: PanelAnalyticsMetrics = {
      panelId: '1',
      panelKey: 'panel-1',
      pluginId: 'table',
      totalQueryTime: 100,
      totalFieldConfigTime: 10,
      totalTransformationTime: 0,
      totalRenderTime: 50,
      pluginLoadTime: 5,
      queryOperations: [{ duration: 100, timestamp: Date.now() }],
      fieldConfigOperations: [],
      transformationOperations: [],
      renderOperations: [{ duration: 50, timestamp: Date.now() }],
    };

    // Act: Render the component
    const { rerender } = render(<panelMetrics.Component model={panelMetrics} />);

    // Wait for activation to complete and callback to be stored
    await waitFor(() => {
      expect(storedCallback).not.toBeNull();
    });

    // Trigger the callback with metrics
    await act(async () => {
      if (storedCallback) {
        storedCallback(mockMetrics);
      }
      // Advance timers to process setTimeout
      jest.advanceTimersByTime(10);
    });

    // Force rerender to see updated state
    await act(async () => {
      rerender(<panelMetrics.Component model={panelMetrics} />);
    });

    // Assert: Transform metric should NOT be displayed
    await waitFor(() => {
      expect(screen.queryByText(/T:/)).not.toBeInTheDocument();
    });
  });
});
