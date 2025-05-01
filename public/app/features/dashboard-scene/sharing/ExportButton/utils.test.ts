import { of } from 'rxjs';

import { config, getBackendSrv } from '@grafana/runtime';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';

import {
  calculateGridBasedHeight,
  calculateDOMBasedHeight,
  calculateDashboardHeight,
  generateDashboardImage,
  GRID_CELL_HEIGHT,
  GRID_CELL_MARGIN,
  EXTRA_PADDING,
  MIN_DASHBOARD_HEIGHT,
} from './utils';

// Define proper types for our mocks
interface MockGridItem {
  state: {
    height?: number;
    y?: number;
    repeatedPanels?: number[];
    itemHeight?: number;
  };
  constructor: {
    name: string;
  };
  getRepeatDirection?: () => 'h' | 'v';
  getMaxPerRow?: () => number;
}

interface MockRowItem extends MockGridItem {
  state: MockGridItem['state'] & {
    children: MockGridItem[];
    isCollapsed?: boolean;
  };
}

interface MockLayout {
  state: {
    grid: {
      state: {
        children: Array<MockGridItem | MockRowItem>;
      };
    };
  };
  constructor: {
    name: string;
  };
}

interface MockDashboard {
  state: {
    uid: string;
    body?: MockLayout;
  };
}

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

jest.mock('../../scene/layout-default/DefaultGridLayoutManager', () => ({
  DefaultGridLayoutManager: class DefaultGridLayoutManager {
    state = {
      grid: {
        state: {
          children: [] as Array<MockGridItem | MockRowItem>,
        },
      },
    };
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

  describe('calculateGridBasedHeight', () => {
    it('should handle empty grid and return extra padding', () => {
      const layout: MockLayout = {
        state: { grid: { state: { children: [] } } },
        constructor: { name: 'DefaultGridLayoutManager' },
      };

      expect(calculateGridBasedHeight(layout as unknown as DefaultGridLayoutManager)).toBe(EXTRA_PADDING);
    });

    it('should calculate correct height for grid items with various configurations', () => {
      const gridItems: MockGridItem[] = [
        {
          state: { height: 8, y: 0 },
          constructor: { name: 'DashboardGridItem' },
        },
        {
          state: { height: 6, y: 9 },
          constructor: { name: 'DashboardGridItem' },
        },
        {
          state: { height: undefined, y: 16 }, // Test undefined height
          constructor: { name: 'DashboardGridItem' },
        },
        {
          state: { height: 4, y: undefined }, // Test undefined y
          constructor: { name: 'DashboardGridItem' },
        },
      ];

      const layout: MockLayout = {
        state: { grid: { state: { children: gridItems } } },
        constructor: { name: 'DefaultGridLayoutManager' },
      };

      const expectedHeight = 16 * GRID_CELL_HEIGHT + 15 * GRID_CELL_MARGIN + EXTRA_PADDING;
      expect(calculateGridBasedHeight(layout as unknown as DefaultGridLayoutManager)).toBe(expectedHeight);
    });

    it('should handle row with children and collapsed state', () => {
      const rowItem: MockRowItem = {
        state: {
          height: 1,
          y: 0,
          children: [
            {
              state: { height: 8, y: 0 },
              constructor: { name: 'DashboardGridItem' },
            },
          ],
          isCollapsed: true,
        },
        constructor: { name: 'SceneGridRow' },
      };

      const layout: MockLayout = {
        state: { grid: { state: { children: [rowItem] } } },
        constructor: { name: 'DefaultGridLayoutManager' },
      };

      expect(calculateGridBasedHeight(layout as unknown as DefaultGridLayoutManager)).toBe(
        GRID_CELL_HEIGHT + EXTRA_PADDING
      );

      // Test expanded row
      rowItem.state.isCollapsed = false;
      const expectedExpandedHeight = 9 * GRID_CELL_HEIGHT + 8 * GRID_CELL_MARGIN + EXTRA_PADDING;
      expect(calculateGridBasedHeight(layout as unknown as DefaultGridLayoutManager)).toBe(expectedExpandedHeight);
    });

    it('should handle repeated panels in both directions', () => {
      const testRepeatConfig = (direction: 'h' | 'v', expectedMultiplier: number) => {
        const gridItem: MockGridItem = {
          state: {
            height: 8,
            y: 0,
            repeatedPanels: [1, 2, 3, 4, 5],
            itemHeight: 10,
          },
          constructor: { name: 'DashboardGridItem' },
          getRepeatDirection: () => direction,
          getMaxPerRow: () => 2,
        };

        const layout: MockLayout = {
          state: { grid: { state: { children: [gridItem] } } },
          constructor: { name: 'DefaultGridLayoutManager' },
        };

        const expectedHeight =
          expectedMultiplier * GRID_CELL_HEIGHT + (expectedMultiplier - 1) * GRID_CELL_MARGIN + EXTRA_PADDING;
        expect(calculateGridBasedHeight(layout as unknown as DefaultGridLayoutManager)).toBe(expectedHeight);
      };

      testRepeatConfig('h', 30); // 3 rows (ceil(5/2)) * 10
      testRepeatConfig('v', 50); // 5 items * 10
    });
  });

  describe('calculateDOMBasedHeight', () => {
    const createMockRect = (top: number, bottom: number) => ({
      top,
      bottom,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    it('should handle empty container and return 0', () => {
      const container = document.createElement('div');
      container.className = 'dashboard-container';
      document.body.appendChild(container);

      expect(calculateDOMBasedHeight(container)).toBe(0);
    });

    it('should calculate correct height for complex panel layouts', () => {
      const container = document.createElement('div');
      container.className = 'dashboard-container';
      document.body.appendChild(container);

      // Create a row with nested panels
      const row = document.createElement('div');
      row.className = 'dashboard-row';
      container.appendChild(row);

      const panel1 = document.createElement('div');
      panel1.className = 'panel-container';
      row.appendChild(panel1);

      const panel2 = document.createElement('div');
      panel2.className = 'panel-container';
      row.appendChild(panel2);

      // Create a standalone panel
      const panel3 = document.createElement('div');
      panel3.className = 'panel-container';
      container.appendChild(panel3);

      // Mock getBoundingClientRect for all elements
      jest.spyOn(container, 'getBoundingClientRect').mockReturnValue(createMockRect(100, 400));
      jest.spyOn(row, 'getBoundingClientRect').mockReturnValue(createMockRect(100, 300));
      jest.spyOn(panel1, 'getBoundingClientRect').mockReturnValue(createMockRect(100, 250));
      jest.spyOn(panel2, 'getBoundingClientRect').mockReturnValue(createMockRect(100, 300));
      jest.spyOn(panel3, 'getBoundingClientRect').mockReturnValue(createMockRect(300, 400));

      expect(calculateDOMBasedHeight(container)).toBe(300 + EXTRA_PADDING); // 400 - 100 + EXTRA_PADDING
    });

    it('should handle errors gracefully and continue processing', () => {
      const container = document.createElement('div');
      container.className = 'dashboard-container';
      document.body.appendChild(container);

      const panel1 = document.createElement('div');
      panel1.className = 'panel-container';
      container.appendChild(panel1);

      const panel2 = document.createElement('div');
      panel2.className = 'panel-container';
      container.appendChild(panel2);

      // Mock container getBoundingClientRect
      jest.spyOn(container, 'getBoundingClientRect').mockReturnValue(createMockRect(0, 0));

      // First panel throws error, second panel works
      jest.spyOn(panel1, 'getBoundingClientRect').mockImplementation(() => {
        throw new Error('Test error');
      });
      jest.spyOn(panel2, 'getBoundingClientRect').mockReturnValue(createMockRect(0, 200));

      expect(calculateDOMBasedHeight(container)).toBe(200 + EXTRA_PADDING);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Error getting panel dimensions:', expect.any(Error));
    });
  });

  describe('calculateDashboardHeight', () => {
    const createMockRect = (top: number, bottom: number) => ({
      top,
      bottom,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    it('should return minimum height when no layout or container exists', () => {
      const dashboard = { state: {} } as unknown as DashboardScene;
      expect(calculateDashboardHeight(dashboard)).toBe(MIN_DASHBOARD_HEIGHT);
    });

    it('should use maximum of grid, DOM, and minimum heights', () => {
      // Setup DOM height
      const container = document.createElement('div');
      container.className = 'dashboard-container';
      document.body.appendChild(container);

      const panel = document.createElement('div');
      panel.className = 'panel-container';
      container.appendChild(panel);

      jest.spyOn(container, 'getBoundingClientRect').mockReturnValue(createMockRect(0, 500));
      jest.spyOn(panel, 'getBoundingClientRect').mockReturnValue(createMockRect(0, 500));

      // Setup grid height
      const gridItem: MockGridItem = {
        state: { height: 8, y: 0 },
        constructor: { name: 'DashboardGridItem' },
      };

      const layout: MockLayout = {
        state: { grid: { state: { children: [gridItem] } } },
        constructor: { name: 'DefaultGridLayoutManager' },
      };

      const dashboard = {
        state: { body: layout },
      } as unknown as DashboardScene;

      const gridHeight = 8 * GRID_CELL_HEIGHT + 7 * GRID_CELL_MARGIN + EXTRA_PADDING;
      const domHeight = 500 + EXTRA_PADDING;

      expect(calculateDashboardHeight(dashboard)).toBe(Math.max(gridHeight, domHeight, MIN_DASHBOARD_HEIGHT));
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
        state: { uid: 'test-uid' },
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
        state: { uid: 'test-uid' },
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
