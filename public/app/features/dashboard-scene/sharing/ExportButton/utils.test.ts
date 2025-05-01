import { of } from 'rxjs';

import { config, getBackendSrv } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';

import {
  generateDashboardImage,
  GRID_CELL_HEIGHT,
  GRID_CELL_MARGIN,
  EXTRA_PADDING,
  MIN_DASHBOARD_HEIGHT,
  calculateDashboardDimensions,
} from './utils';

// Mock the dependencies
jest.mock('@grafana/runtime', () => ({
  config: {
    rendererAvailable: true,
    theme2: {
      isDark: false,
    },
    bootData: {
      user: {
        orgId: 1,
      },
    },
    rendererDefaultImageScale: 1,
  } as typeof config,
  getBackendSrv: jest.fn(),
}));

jest.mock('../../scene/DashboardScene', () => ({
  DashboardScene: class DashboardScene {
    state: Record<string, unknown> = {};
  },
}));

jest.mock('../../scene/layout-default/DashboardGridItem', () => ({
  DashboardGridItem: class DashboardGridItem {
    state: Record<string, unknown> = {};
  },
}));

jest.mock('app/features/dashboard-scene/utils/getDashboardUrl', () => ({
  getDashboardUrl: jest
    .fn()
    .mockImplementation((params: { updateQuery?: Record<string, string | number | boolean> }) => {
      const url = new URL('http://test-url');
      if (params.updateQuery) {
        Object.entries(params.updateQuery).forEach(([key, value]) => {
          url.searchParams.append(key, String(value));
        });
      }
      return url.toString();
    }),
}));

// Mock location
Object.defineProperty(window, 'location', {
  value: {
    search: '',
  },
  writable: true,
});

describe('Dashboard Export Image Utils', () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.innerHTML = '';
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('calculateDashboardDimensions', () => {
    beforeEach(() => {
      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1104,
      });
    });

    it('should return minimum dimensions when no panels exist', () => {
      const mockDashboard = {
        state: {
          body: {
            getVizPanels: () => [] as VizPanel[],
          },
        },
      } as unknown as DashboardScene;

      const dimensions = calculateDashboardDimensions(mockDashboard);
      expect(dimensions.height).toBe(MIN_DASHBOARD_HEIGHT + EXTRA_PADDING);
      expect(dimensions.width).toBe(window.innerWidth + EXTRA_PADDING);
    });

    it('should calculate correct dimensions based on panel grid positions', () => {
      const mockPanels = [
        {
          parent: new DashboardGridItem({
            x: 0,
            y: 0,
            width: 12,
            height: 8,
            body: {} as VizPanel,
          }),
        },
        {
          parent: new DashboardGridItem({
            x: 12,
            y: 0,
            width: 12,
            height: 8,
            body: {} as VizPanel,
          }),
        },
        {
          parent: new DashboardGridItem({
            x: 0,
            y: 8,
            width: 24,
            height: 8,
            body: {} as VizPanel,
          }),
        },
      ] as unknown as VizPanel[];

      const mockDashboard = {
        state: {
          body: {
            getVizPanels: () => mockPanels,
          },
        },
      } as unknown as DashboardScene;

      const dimensions = calculateDashboardDimensions(mockDashboard);

      // Calculate expected width based on the rightmost panel
      // x=0 * (30px + 8px) + 24 cells * 30px + 23 margins * 8px + padding
      const x = 0;
      const width = 24;
      const expectedWidth = Math.max(
        x * (GRID_CELL_HEIGHT + GRID_CELL_MARGIN) +
          width * GRID_CELL_HEIGHT +
          (width - 1) * GRID_CELL_MARGIN +
          EXTRA_PADDING,
        window.innerWidth + EXTRA_PADDING
      );

      expect(dimensions.height).toBe(MIN_DASHBOARD_HEIGHT + EXTRA_PADDING);
      expect(dimensions.width).toBe(expectedWidth);
    });

    it('should handle undefined grid positions gracefully', () => {
      const mockPanels = [
        {
          parent: new DashboardGridItem({
            // x and y are undefined
            width: 12,
            height: 8,
            body: {} as VizPanel,
          }),
        },
      ] as unknown as VizPanel[];

      const mockDashboard = {
        state: {
          body: {
            getVizPanels: () => mockPanels,
          },
        },
      } as unknown as DashboardScene;

      const dimensions = calculateDashboardDimensions(mockDashboard);

      // Calculate expected width based on the panel width
      // x=0 * (30px + 8px) + 12 cells * 30px + 11 margins * 8px + padding
      const x = 0;
      const width = 12;
      const expectedWidth = Math.max(
        x * (GRID_CELL_HEIGHT + GRID_CELL_MARGIN) +
          width * GRID_CELL_HEIGHT +
          (width - 1) * GRID_CELL_MARGIN +
          EXTRA_PADDING,
        window.innerWidth + EXTRA_PADDING
      );

      expect(dimensions.height).toBe(MIN_DASHBOARD_HEIGHT + EXTRA_PADDING);
      expect(dimensions.width).toBe(expectedWidth);
    });
  });

  describe('generateDashboardImage', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle various error scenarios', async () => {
      const testCases = [
        {
          setup: () => {
            (config as { rendererAvailable: boolean }).rendererAvailable = false;
          },
          expectedError: 'Image renderer plugin not installed',
        },
        {
          setup: () => {
            (config as { rendererAvailable: boolean }).rendererAvailable = true;
            (getBackendSrv as jest.Mock).mockReturnValue({
              fetch: jest.fn().mockReturnValue(of({ ok: false, status: 500, statusText: 'Server Error' })),
            });
          },
          expectedError: 'Failed to generate image: 500 Server Error',
        },
        {
          setup: () => {
            (getBackendSrv as jest.Mock).mockReturnValue({
              fetch: jest.fn().mockReturnValue(of({ ok: true, data: 'invalid-data' })),
            });
          },
          expectedError: 'Invalid response data format',
        },
        {
          setup: () => {
            (getBackendSrv as jest.Mock).mockReturnValue({
              fetch: jest.fn().mockReturnValue(of(Promise.reject(new Error('Network error')))),
            });
          },
          expectedError: 'Network error',
        },
      ];

      const dashboard = {
        state: {
          uid: 'test-uid',
          body: {
            getVizPanels: () => [] as VizPanel[],
          },
        },
      } as unknown as DashboardScene;

      for (const testCase of testCases) {
        testCase.setup();
        const result = await generateDashboardImage({ dashboard });
        expect(result.error).toBe(testCase.expectedError);
        expect(result.blob).toBeInstanceOf(Blob);
        expect(result.blob.size).toBe(0);
      }
    });

    it('should generate image successfully with custom options', async () => {
      (config as { rendererAvailable: boolean }).rendererAvailable = true;
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      const fetchMock = jest.fn().mockReturnValue(of({ ok: true, data: mockBlob }));
      (getBackendSrv as jest.Mock).mockReturnValue({ fetch: fetchMock });

      const dashboard = {
        state: {
          uid: 'test-uid',
          body: {
            getVizPanels: () => [] as VizPanel[],
          },
        },
      } as unknown as DashboardScene;

      const result = await generateDashboardImage({ dashboard, format: 'jpg', scale: 2 });

      expect(result.error).toBeUndefined();
      expect(result.blob).toBe(mockBlob);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringMatching(/format=jpg.*scale=2.*kiosk=true.*hideNav=true.*fullPageImage=true/),
          responseType: 'blob',
        })
      );
    });
  });
});
