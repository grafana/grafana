import { of } from 'rxjs';

import { config, getBackendSrv } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { getDashboardUrl } from 'app/features/dashboard-scene/utils/getDashboardUrl';

import { DashboardScene } from '../../scene/DashboardScene';

import { generateDashboardImage } from './utils';

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
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('generateDashboardImage', () => {
    it('should handle various error scenarios', async () => {
      const testCases = [
        {
          setup: () => {
            (config as { rendererAvailable: boolean }).rendererAvailable = false;
            // Reset the mock for this test case
            (getBackendSrv as jest.Mock).mockReset();
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
            (config as { rendererAvailable: boolean }).rendererAvailable = true;
            (getBackendSrv as jest.Mock).mockReturnValue({
              fetch: jest.fn().mockReturnValue(of({ ok: true, data: 'invalid-data' })),
            });
          },
          expectedError: 'Invalid response data format',
        },
        {
          setup: () => {
            (config as { rendererAvailable: boolean }).rendererAvailable = true;
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

    it('should generate image successfully with custom scale', async () => {
      (config as { rendererAvailable: boolean }).rendererAvailable = true;
      const mockBlob = new Blob(['test'], { type: 'image/png' });
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

      const result = await generateDashboardImage({ dashboard, scale: 2 });

      expect(result.error).toBeUndefined();
      expect(result.blob).toBe(mockBlob);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringMatching(/height=-1.*scale=2.*kiosk=true.*hideNav=true.*fullPageImage=true/),
          responseType: 'blob',
        })
      );
      expect(getDashboardUrl).toHaveBeenCalledWith({
        uid: 'test-uid',
        currentQueryParams: '',
        render: true,
        absolute: true,
        updateQuery: {
          height: -1,
          width: 1000,
          scale: 2,
          kiosk: true,
          hideNav: true,
          orgId: '1',
          fullPageImage: true,
        },
      });
    });
  });
});
