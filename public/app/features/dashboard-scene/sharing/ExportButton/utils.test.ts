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
  };
  constructor: {
    name: string;
  };
}

interface MockLayout {
  state: {
    grid: {
      state: {
        children: MockGridItem[];
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

interface MockResponse {
  ok: boolean;
  status?: number;
  statusText?: string;
  data: ArrayBuffer;
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
  },
  getBackendSrv: jest.fn(),
}));

jest.mock('../../scene/DashboardScene', () => ({
  DashboardScene: class DashboardScene {
    state = {};
  },
}));

jest.mock('../../scene/layout-default/DashboardGridItem', () => ({
  DashboardGridItem: class DashboardGridItem {
    state = {};
  },
}));

jest.mock('../../scene/layout-default/DefaultGridLayoutManager', () => ({
  DefaultGridLayoutManager: class DefaultGridLayoutManager {
    state = {
      grid: {
        state: {
          children: [],
        },
      },
    };
  },
}));

jest.mock('app/features/dashboard-scene/utils/getDashboardUrl', () => ({
  getDashboardUrl: jest.fn().mockReturnValue('http://test-url'),
}));

// Mock location
Object.defineProperty(window, 'location', {
  value: {
    search: '',
  },
  writable: true,
});

describe('Dashboard Export Image Utils', () => {
  describe('calculateGridBasedHeight', () => {
    it('should calculate correct height for single panel', () => {
      const gridItem: MockGridItem = {
        state: {
          height: 8,
          y: 0,
        },
        constructor: {
          name: 'DashboardGridItem',
        },
      };

      const layout: MockLayout = {
        state: {
          grid: {
            state: {
              children: [gridItem],
            },
          },
        },
        constructor: {
          name: 'DefaultGridLayoutManager',
        },
      };

      const expectedHeight = 8 * GRID_CELL_HEIGHT + 7 * GRID_CELL_MARGIN + EXTRA_PADDING;
      expect(calculateGridBasedHeight(layout as unknown as DefaultGridLayoutManager)).toBe(expectedHeight);
    });

    it('should calculate correct height for multiple panels', () => {
      const gridItems: MockGridItem[] = [
        {
          state: {
            height: 8,
            y: 0,
          },
          constructor: {
            name: 'DashboardGridItem',
          },
        },
        {
          state: {
            height: 8,
            y: 9,
          },
          constructor: {
            name: 'DashboardGridItem',
          },
        },
      ];

      const layout: MockLayout = {
        state: {
          grid: {
            state: {
              children: gridItems,
            },
          },
        },
        constructor: {
          name: 'DefaultGridLayoutManager',
        },
      };

      const expectedHeight = 17 * GRID_CELL_HEIGHT + 16 * GRID_CELL_MARGIN + EXTRA_PADDING;
      expect(calculateGridBasedHeight(layout as unknown as DefaultGridLayoutManager)).toBe(expectedHeight);
    });

    it('should handle empty grid', () => {
      const layout: MockLayout = {
        state: {
          grid: {
            state: {
              children: [],
            },
          },
        },
        constructor: {
          name: 'DefaultGridLayoutManager',
        },
      };

      const expectedHeight = EXTRA_PADDING;
      expect(calculateGridBasedHeight(layout as unknown as DefaultGridLayoutManager)).toBe(expectedHeight);
    });

    it('should handle panels with missing height or y values', () => {
      const gridItems: MockGridItem[] = [
        {
          state: {
            height: undefined,
            y: 0,
          },
          constructor: {
            name: 'DashboardGridItem',
          },
        },
        {
          state: {
            height: 8,
            y: undefined,
          },
          constructor: {
            name: 'DashboardGridItem',
          },
        },
      ];

      const layout: MockLayout = {
        state: {
          grid: {
            state: {
              children: gridItems,
            },
          },
        },
        constructor: {
          name: 'DefaultGridLayoutManager',
        },
      };

      const expectedHeight = 8 * GRID_CELL_HEIGHT + 7 * GRID_CELL_MARGIN + EXTRA_PADDING;
      expect(calculateGridBasedHeight(layout as unknown as DefaultGridLayoutManager)).toBe(expectedHeight);
    });

    it('should handle non-grid items in children', () => {
      const gridItems: MockGridItem[] = [
        {
          state: {
            height: 8,
            y: 0,
          },
          constructor: {
            name: 'DashboardGridItem',
          },
        },
        {
          state: {
            height: 10,
            y: 9,
          },
          constructor: {
            name: 'NonGridItem',
          },
        },
      ];

      const layout: MockLayout = {
        state: {
          grid: {
            state: {
              children: gridItems,
            },
          },
        },
        constructor: {
          name: 'DefaultGridLayoutManager',
        },
      };

      const expectedHeight = 8 * GRID_CELL_HEIGHT + 7 * GRID_CELL_MARGIN + EXTRA_PADDING;
      expect(calculateGridBasedHeight(layout as unknown as DefaultGridLayoutManager)).toBe(expectedHeight);
    });
  });

  describe('calculateDOMBasedHeight', () => {
    beforeEach(() => {
      // Mock document.querySelectorAll
      document.querySelectorAll = jest.fn().mockReturnValue([
        {
          getBoundingClientRect: () => ({
            bottom: 500,
          }),
        },
        {
          getBoundingClientRect: () => ({
            bottom: 800,
          }),
        },
      ]);
    });

    it('should calculate correct height based on DOM elements', () => {
      const container = {
        getBoundingClientRect: () => ({
          top: 100,
        }),
      } as unknown as HTMLElement;

      const expectedHeight = 800 - 100 + EXTRA_PADDING; // maxBottom - containerTop + padding
      expect(calculateDOMBasedHeight(container)).toBe(expectedHeight);
    });

    it('should handle no panels found', () => {
      document.querySelectorAll = jest.fn().mockReturnValue([]);

      const container = document.createElement('div');
      Object.defineProperty(container, 'getBoundingClientRect', {
        value: () => ({
          top: 100,
        }),
      });

      const expectedHeight = 0 - 100 + EXTRA_PADDING;
      expect(calculateDOMBasedHeight(container)).toBe(expectedHeight);
    });

    it('should handle panels with invalid getBoundingClientRect', () => {
      document.querySelectorAll = jest.fn().mockReturnValue([
        {
          getBoundingClientRect: () => null,
        },
        {
          getBoundingClientRect: () => ({
            bottom: 800,
          }),
        },
      ]);

      const container = document.createElement('div');
      Object.defineProperty(container, 'getBoundingClientRect', {
        value: () => ({
          top: 100,
        }),
      });

      const expectedHeight = 800 - 100 + EXTRA_PADDING;
      expect(calculateDOMBasedHeight(container)).toBe(expectedHeight);
    });
  });

  describe('calculateDashboardHeight', () => {
    it('should return minimum height when no layout or DOM elements exist', () => {
      const dashboard: MockDashboard = {
        state: {
          uid: 'test',
          body: undefined,
        },
      };

      document.querySelector = jest.fn().mockReturnValue(null);
      expect(calculateDashboardHeight(dashboard as unknown as DashboardScene)).toBe(MIN_DASHBOARD_HEIGHT);
    });

    it('should use maximum of grid and DOM based calculations', () => {
      // Create a mock layout with a single panel
      const gridItem: MockGridItem = {
        state: {
          height: 8,
          y: 0,
        },
        constructor: {
          name: 'DashboardGridItem',
        },
      };

      const layout: MockLayout = {
        state: {
          grid: {
            state: {
              children: [gridItem],
            },
          },
        },
        constructor: {
          name: 'DefaultGridLayoutManager',
        },
      };

      // Create a mock dashboard with our layout
      const dashboard: MockDashboard = {
        state: {
          uid: 'test',
          body: layout,
        },
      };

      // Mock DOM elements
      const container = document.createElement('div');
      Object.defineProperty(container, 'getBoundingClientRect', {
        value: () => ({
          top: 100,
        }),
      });

      // Mock document.querySelector and document.querySelectorAll
      document.querySelector = jest.fn().mockImplementation((selector) => {
        if (selector === '.dashboard-container') {
          return container;
        }
        return null;
      });

      document.querySelectorAll = jest.fn().mockReturnValue([
        {
          getBoundingClientRect: () => ({
            bottom: 1000,
          }),
        },
      ]);

      // Calculate expected heights
      const gridBasedHeight = 8 * GRID_CELL_HEIGHT + 7 * GRID_CELL_MARGIN + EXTRA_PADDING;
      const domBasedHeight = 1000 - 100 + EXTRA_PADDING;
      const expectedHeight = Math.max(gridBasedHeight, domBasedHeight);

      const result = calculateDashboardHeight(dashboard as unknown as DashboardScene);
      expect(result).toBe(expectedHeight);
    });

    it('should handle missing dashboard body', () => {
      const dashboard: MockDashboard = {
        state: {
          uid: 'test',
        },
      };

      document.querySelector = jest.fn().mockReturnValue(null);
      expect(calculateDashboardHeight(dashboard as unknown as DashboardScene)).toBe(MIN_DASHBOARD_HEIGHT);
    });

    it('should handle invalid dashboard container', () => {
      const dashboard: MockDashboard = {
        state: {
          uid: 'test',
          body: undefined,
        },
      };

      // Mock an invalid container that's not an HTMLElement
      document.querySelector = jest.fn().mockReturnValue({} as Element);
      expect(calculateDashboardHeight(dashboard as unknown as DashboardScene)).toBe(MIN_DASHBOARD_HEIGHT);
    });
  });

  describe('generateDashboardImage', () => {
    const mockDashboard: MockDashboard = {
      state: {
        uid: 'test-uid',
      },
    };

    const mockResponse: MockResponse = {
      ok: true,
      data: new ArrayBuffer(8),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(console, 'error').mockImplementation(() => {});
      (config as { rendererAvailable: boolean }).rendererAvailable = true;
      (getBackendSrv as jest.Mock).mockReturnValue({
        fetch: jest.fn().mockReturnValue(of(mockResponse)),
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should generate image successfully', async () => {
      const result = await generateDashboardImage({
        dashboard: mockDashboard as unknown as DashboardScene,
        format: 'png',
        scale: 1,
      });

      expect(result.error).toBeUndefined();
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toBe('image/png');
    });

    it('should handle renderer not available', async () => {
      (config as { rendererAvailable: boolean }).rendererAvailable = false;

      const result = await generateDashboardImage({
        dashboard: mockDashboard as unknown as DashboardScene,
        format: 'png',
      });

      expect(result.error).toBe('Image renderer plugin not installed');
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.size).toBe(0);
    });

    it('should handle failed response', async () => {
      (getBackendSrv as jest.Mock).mockReturnValue({
        fetch: jest.fn().mockReturnValue(
          of({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          })
        ),
      });

      const result = await generateDashboardImage({
        dashboard: mockDashboard as unknown as DashboardScene,
        format: 'jpg',
      });

      expect(result.error).toBe('Failed to generate image: 500 Internal Server Error');
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.size).toBe(0);
    });

    it('should handle fetch error', async () => {
      (getBackendSrv as jest.Mock).mockReturnValue({
        fetch: jest.fn().mockReturnValue(of(Promise.reject(new Error('Network error')))),
      });

      const result = await generateDashboardImage({
        dashboard: mockDashboard as unknown as DashboardScene,
        format: 'png',
      });

      expect(result.error).toBe('Network error');
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.size).toBe(0);
    });
  });
});
